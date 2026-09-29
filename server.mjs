// server.mjs: serves the TeachBack page and forwards AI requests.
// No dependencies: needs Node.js 18 or newer. Start it with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
loadEnv(join(ROOT, ".env"));
const { callModel, describe, AIError } = await import("./ai.mjs");

const PORT = Number(process.env.PORT || 3000);
// 127.0.0.1 = only this computer can use the server (and your API key).
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC = join(ROOT, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req, limit = 2e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("Request too large."), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

let active = 0;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, describe());

    if (req.method === "POST" && url.pathname === "/api/llm") {
      const body = JSON.parse(await readBody(req));
      if (typeof body.system !== "string" || typeof body.user !== "string" || typeof body.schema !== "object") return send(res, 400, { ok: false, kind: "bad_request", message: "Expected system, user and schema." });
      const started = Date.now();
      active++;
      try {
        const data = await callModel(body);
        console.log(`AI call ok in ${Date.now() - started} ms (${active} active)`);
        return send(res, 200, { ok: true, data });
      } catch (e) {
        const kind = e instanceof AIError ? e.kind : "unavailable";
        console.warn(`AI call failed (${kind}): ${e.message}`);
        return send(res, 502, { ok: false, kind, message: e.message });
      } finally {
        active--;
      }
    }

    if (req.method === "GET" || req.method === "HEAD") {
      const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const file = normalize(join(PUBLIC, rel));
      if (!file.startsWith(PUBLIC + sep) || !existsSync(file)) return send(res, 404, "Not found", "text/plain");
      return send(res, 200, await readFile(file), TYPES[extname(file)] || "application/octet-stream");
    }
    send(res, 405, "Method not allowed", "text/plain");
  } catch (e) {
    send(res, e.status || 500, { ok: false, kind: "server_error", message: e.message });
  }
});

server.listen(PORT, HOST, () => {
  const d = describe();
  console.log(`\nTeachBack is running at http://localhost:${PORT}`);
  console.log(d.available ? `AI: ${d.provider} (${d.model})` : "AI: not set up yet. Demo mode still works. See README step 4.");
  console.log("Press Ctrl+C to stop.\n");
});
