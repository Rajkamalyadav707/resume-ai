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