// Copies the root logo.png into public/brand (never modifying the original) and derives
// logo-light.png for dark sections by recoloring the near-black wordmark to bone.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const src = path.join(root, "logo.png");
const brandDir = path.join(root, "public", "brand");
fs.mkdirSync(brandDir, { recursive: true });
const copy = path.join(brandDir, "logo.png");
fs.copyFileSync(src, copy);

const { data, info } = await sharp(copy).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const total = width * height;
let transparent = 0;
let recolored = 0;
for (let i = 0; i < data.length; i += channels) {
  const alpha = data[i + 3];
  if (alpha < 16) {
    transparent += 1;
    continue;
  }
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 110 && max - min < 40) {
    data[i] = 245;
    data[i + 1] = 244;
    data[i + 2] = 241;
    recolored += 1;
  }
}
const pct = ((transparent / total) * 100).toFixed(1);
console.log(`logo: ${width}x${height}, transparent pixels: ${pct}%, recolored dark pixels: ${recolored}`);
if (transparent === 0) {
  console.error("SOLID BACKGROUND: the logo has no transparent pixels. Stop and ask before deriving variants.");
  process.exit(2);
}
await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile(path.join(brandDir, "logo-light.png"));
console.log("wrote public/brand/logo.png and public/brand/logo-light.png");
