import test from "node:test";
import assert from "node:assert/strict";
import { parseJson, text } from "../api/_lib/ica.mjs";

test("text validates non-empty bounded strings", () => {
  assert.equal(text("  resume  ", 20), "resume");
  assert.equal(text("", 20), null);
  assert.equal(text("toolong", 3), null);
});
test("parseJson accepts plain and fenced JSON", () => {
  assert.deepEqual(parseJson('{"score": 80}'), { score: 80 });
  assert.deepEqual(parseJson('```json\n{"score": 80}\n```'), { score: 80 });
});
test("parseJson rejects invalid responses", () => {
  assert.throws(() => parseJson("not json"));
});