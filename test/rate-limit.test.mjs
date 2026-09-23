import test from "node:test";
import assert from "node:assert/strict";
import { enforceRateLimit, resetRateLimits } from "../api/_lib/rate-limit.mjs";

function responseRecorder() {
  return { statusCode: 200, body: undefined, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(name, value) { this.headers[name] = value; return this; }, send(body) { this.body = body; return this; } };
}

test("rate limiter allows requests until a route limit is reached and then returns 429", async () => {
  resetRateLimits();
  const request = { headers: { "x-vercel-forwarded-for": "203.0.113.24" } };
  assert.equal(await enforceRateLimit(request, responseRecorder(), { name: "test", limit: 2, windowSeconds: 60 }), true);
  assert.equal(await enforceRateLimit(request, responseRecorder(), { name: "test", limit: 2, windowSeconds: 60 }), true);
  const response = responseRecorder();
  assert.equal(await enforceRateLimit(request, response, { name: "test", limit: 2, windowSeconds: 60 }), false);
  assert.equal(response.statusCode, 429);
  assert.match(response.body.error, /too many requests/i);
  assert.ok(Number(response.headers["Retry-After"]) >= 1);
});

test("rate limiter keeps caller and endpoint buckets separate", async () => {
  resetRateLimits();
  const firstCaller = { headers: { "x-vercel-forwarded-for": "203.0.113.25" } };
  const secondCaller = { headers: { "x-vercel-forwarded-for": "203.0.113.26" } };
  assert.equal(await enforceRateLimit(firstCaller, responseRecorder(), { name: "analysis", limit: 1, windowSeconds: 60 }), true);
  assert.equal(await enforceRateLimit(secondCaller, responseRecorder(), { name: "analysis", limit: 1, windowSeconds: 60 }), true);
  assert.equal(await enforceRateLimit(firstCaller, responseRecorder(), { name: "chat", limit: 1, windowSeconds: 60 }), true);
});