import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PDF resume extraction configures Vite's bundled PDF.js worker", async () => {
  const source = await readFile(new URL("../src/utils/files.ts", import.meta.url), "utf8");
  assert.match(source, /import pdfWorkerUrl from "pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs\?url"/);
  assert.match(source, /pdfjs\.GlobalWorkerOptions\.workerSrc = pdfWorkerUrl/);
});