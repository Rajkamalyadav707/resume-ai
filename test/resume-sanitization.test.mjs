import test from "node:test";
import assert from "node:assert/strict";

test("condense endpoint source removes control characters and markdown artifacts", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../api/condense-resume.mjs", import.meta.url), "utf8"),
  );
  assert.match(source, /uFFFD/);
  assert.match(source, /```/);
  assert.match(source, /cleanStrings/);
});
