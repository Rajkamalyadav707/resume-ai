/**
 * Local development host for the Vite client and the same Vercel API handlers
 * deployed from /api. It exists because Vite alone does not execute Vercel
 * Functions, so requests to /api/* otherwise return 404 during local testing.
 */
import { createServer as createHttpServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createServer as createViteServer } from "vite";

function loadEnvFile() {
  const envPath = resolve(".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

const routes = {
  "/api/analyze-resume": "./api/analyze-resume.mjs",
  "/api/optimize-resume": "./api/optimize-resume.mjs",
  "/api/job-details": "./api/job-details.mjs",
  "/api/resume-chat": "./api/resume-chat.mjs"
};
const limit = 150_000;

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function attachVercelResponse(response) {
  response.status = (code) => { response.statusCode = code; return response; };
  response.send = (body) => {
    if (!response.getHeader("Content-Type")) response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(typeof body === "string" ? body : JSON.stringify(body));
    return response;
  };
  return response;
}

async function getBody(request) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Request too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

loadEnvFile();
const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
const server = createHttpServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  const modulePath = routes[pathname];
  if (!modulePath) return vite.middlewares(request, response);
  if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed." });
  try {
    request.body = await getBody(request);
    const { default: handler } = await import(modulePath);
    await handler(request, attachVercelResponse(response));
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : error?.message === "Request too large" ? 413 : 500;
    console.error(`Local API error (${pathname}):`, error?.message || "Unknown error");
    if (!response.writableEnded) sendJson(response, status, { error: "The request could not be processed. Please try again." });
  }
});
const port = Number(process.env.PORT || 5173);
server.listen(port, "127.0.0.1", () => console.log(`ResumeAI local development server: http://127.0.0.1:${port}`));