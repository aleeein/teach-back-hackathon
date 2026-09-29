// ai.mjs: the only place that talks to an AI model.
// The browser sends { system, user, schema }; this file sends it to the
// provider you chose in .env and returns one parsed JSON object.

export class AIError extends Error {
  // kind: "auth" | "timeout" | "unavailable" | "refusal" | "invalid_output"
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

export function config() {
  const env = process.env;
  const provider = (env.AI_PROVIDER || (env.ANTHROPIC_API_KEY ? "anthropic" : "none")).trim().toLowerCase();
  return {
    provider,
    anthropicModel: env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
    anthropicUrl: (env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, ""),
    ollamaModel: env.OLLAMA_MODEL || "qwen2.5:7b",
    ollamaUrl: (env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    ollamaCtx: Number(env.OLLAMA_NUM_CTX || 8192),
    ollamaKeepAlive: env.OLLAMA_KEEP_ALIVE || "30m",
    timeoutMs: Number(env.AI_TIMEOUT_MS || 120000)
  };
}

export function describe() {
  const c = config();
  if (c.provider === "anthropic") return { provider: "anthropic", model: c.anthropicModel, available: !!process.env.ANTHROPIC_API_KEY };
  if (c.provider === "ollama") return { provider: "ollama", model: c.ollamaModel, available: true };
  return { provider: "none", model: null, available: false };
}

// Asking for JSON in the prompt as well as through the provider's own
// JSON option makes small local models much more reliable.
const jsonInstruction = (schema) => `

=====
Reply with only one JSON object that matches this JSON Schema exactly (every listed property present, no other properties). No prose and no code fences.
${JSON.stringify(schema)}`;

export function parseJSON(text) {
  const t = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("no JSON object found");
}

async function post(url, headers, body, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (e) {
    if (e.name === "AbortError") throw new AIError("timeout", "The AI took too long to reply. Try again.");
    throw new AIError("unavailable", `Couldn't reach the AI service (${e.cause?.code || e.message}).`);
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic({ system, user, schema, maxTokens }, c) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AIError("auth", "ANTHROPIC_API_KEY is missing from your .env file.");
  const { res, data } = await post(`${c.anthropicUrl}/v1/messages`, { "x-api-key": key, "anthropic-version": "2023-06-01" }, {
    model: c.anthropicModel,
    max_tokens: Math.min(Number(maxTokens) || 8000, 16000),
    system,
    messages: [{ role: "user", content: user + jsonInstruction(schema) }]
  }, c.timeoutMs);
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    const kind = res.status === 401 || res.status === 403 ? "auth" : "unavailable";
    throw new AIError(kind, `Claude API: ${msg}`);
  }
  if (data.stop_reason === "refusal") throw new AIError("refusal", "The model declined this request.");
  if (data.stop_reason === "max_tokens") throw new AIError("invalid_output", "The model's reply was cut off.");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return parseJSON(text);
  } catch {
    throw new AIError("invalid_output", "The model didn't return valid JSON.");
  }
}

async function callOllama({ system, user, schema }, c) {
  const { res, data } = await post(`${c.ollamaUrl}/api/chat`, {}, {
    model: c.ollamaModel,
    stream: false,
    format: schema,
    keep_alive: c.ollamaKeepAlive,
    // num_ctx = how much text the model can read at once. Ollama's default is small,
    // and longer TeachBack prompts would be cut off without an error.
    options: { temperature: 0, num_ctx: c.ollamaCtx },
    messages: [{ role: "system", content: system }, { role: "user", content: user + jsonInstruction(schema) }]
  }, c.timeoutMs);
  if (!res.ok) throw new AIError("unavailable", `Ollama: ${data.error || `HTTP ${res.status}`}. Is Ollama running, and have you pulled ${c.ollamaModel}?`);
  try {
    return parseJSON(data.message?.content);
  } catch {
    throw new AIError("invalid_output", "The local model didn't return valid JSON. A larger model may help.");
  }
}

export async function callModel(args) {
  const c = config();
  if (c.provider === "anthropic") return callAnthropic(args, c);
  if (c.provider === "ollama") return callOllama(args, c);
  throw new AIError("auth", "No AI provider is set up. Copy .env.example to .env and fill it in, or use Demo mode.");
}
