import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));

async function render(svgName, pngName, width, height) {
  const svgPath = path.join(dir, svgName);
  const outPath = path.join(dir, pngName);
  const svg = readFileSync(svgPath);
  await sharp(svg, { density: 384 })
    .resize(width, height)
    .png()
    .toFile(outPath);
  console.log('wrote', outPath);
}

await render('logo.svg', 'logo.png', 300, 300);
await render('cover.svg', 'cover.png', 1128, 191);
