// Converts assets-src/* into compressed WebP files in public/images/.
// Photos get two widths (-800, -1600); client logos and small graphics get one.
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'assets-src';
const OUT = 'public/images';
await mkdir(OUT, { recursive: true });

const isLogo = (n) => /^\d+\.png$/.test(n) || /^(sign-|flag|hindu-elephant)/.test(n);
const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

let before = 0;
let after = 0;
for (const file of files) {
  const base = path.parse(file).name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const input = path.join(SRC, file);
  before += (await stat(input)).size;
  const widths = isLogo(file) ? [400] : [800, 1600];
  for (const w of widths) {
    const suffix = widths.length > 1 ? `-${w}` : '';
    const out = path.join(OUT, `${base}${suffix}.webp`);
    await sharp(input)
      .rotate()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: isLogo(file) ? 85 : 72, effort: 5 })
      .toFile(out);
    after += (await stat(out)).size;
  }
}
console.log(`${files.length} images: ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB (all sizes)`);
