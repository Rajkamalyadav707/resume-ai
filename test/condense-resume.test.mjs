import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/condense-resume.mjs";

function responseRecorder() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, setHeader() { return this; }, send(body) { this.body = body; return this; } };
}

test("one-page resume endpoint rejects incomplete resume data before calling AI", async () => {
  const res = responseRecorder();
  await handler({ method: "POST", body: { resume: { name: "Candidate" } } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /complete editable resume/i);
});

test("one-page resume endpoint rejects a non-POST request", async () => {
  const res = responseRecorder();
  await handler({ method: "GET", body: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.match(res.body.error, /method not allowed/i);
});

test("one-page resume endpoint source preserves and normalizes all supplied resume links", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../api/condense-resume.mjs", import.meta.url), "utf8"));
  assert.match(source, /preserveContactLinks/);
  assert.match(source, /function normalizeUrl/);
  assert.match(source, /source\.contact\?\.linkedin/);
  assert.match(source, /source\.contact\?\.github/);
  assert.match(source, /sourceProjects/);
});