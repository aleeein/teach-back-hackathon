// npm run check: sends one tiny request to your AI provider so you know .env works.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = !/^\s*#/.test(line) && line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const { callModel, describe } = await import("../ai.mjs");

const d = describe();
console.log(`Provider: ${d.provider}${d.model ? ` (${d.model})` : ""}`);
if (!d.available) {
  console.log("Not set up. Copy .env.example to .env and fill it in (README step 4).");
  process.exit(1);
}
const t = Date.now();
try {
  const out = await callModel({
    system: "You are a test. Answer briefly.",
    user: "Name one warning sign of a phishing email.",
    schema: { type: "object", additionalProperties: false, required: ["sign"], properties: { sign: { type: "string" } } },
    maxTokens: 200
  });
  console.log(`Works (${Date.now() - t} ms). The model said: ${out.sign}`);
} catch (e) {
  console.log(`Failed: ${e.message}`);
  process.exit(1);
}
