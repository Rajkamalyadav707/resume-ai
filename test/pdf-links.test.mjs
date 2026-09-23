import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PDF renderer writes supported contact and project URLs as URI link annotations", async () => {
  const source = await readFile(new URL("../src/utils/pdf.ts", import.meta.url), "utf8");
  assert.match(source, /Subtype:\s*"Link"/);
  assert.match(source, /S:\s*"URI"/);
  assert.match(source, /resume\.contact\.linkedin/);
  assert.match(source, /resume\.contact\.github/);
  assert.match(source, /text: "LinkedIn"/);
  assert.match(source, /text: "GitHub"/);
  assert.match(source, /Project link/);
  assert.match(source, /normalizeUrl\(item\.link\)/);
});