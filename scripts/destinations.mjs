// Converts the high-resolution destination photos (assets-src/destinations/*.jpg, from Unsplash)
// into sharp WebP files for the stacked destination cards on the home page.
// Cards are up to 1240×720 CSS px and cover-cropped, so each size must fill a 16:9 box of
// its height: 1440 px tall covers a retina laptop, 1080 a standard one, 640 phones and previews.
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'assets-src/destinations';
const OUT = 'public/images';
const HEIGHTS = [640, 1080, 1440];

for (const file of (await readdir(SRC)).filter((f) => /\.jpe?g$/i.test(f))) {
  const name = path.parse(file).name;
  const set = [];
  const meta = await sharp(path.join(SRC, file)).metadata();
  for (const h of HEIGHTS) {
    // Narrower photos (4:3, 3:2) are sized by width so they still fill a 16:9 card edge to edge
    const fit = meta.width / meta.height < 16 / 9 ? { width: Math.round((h * 16) / 9) } : { height: h };
    const { data, info } = await sharp(path.join(SRC, file))
      .rotate()
      .resize({ ...fit, withoutEnlargement: true })
      .sharpen({ sigma: 0.5 })
      .webp({ quality: 76, effort: 6 })
      .toBuffer({ resolveWithObject: true });
    const out = path.join(OUT, `dest-${name}-${info.width}.webp`);
    await sharp(data).toFile(out);
    set.push(`/images/dest-${name}-${info.width}.webp ${info.width}w (${Math.round((await stat(out)).size / 1024)} KB)`);
  }
  console.log(name.padEnd(14), set.join(', '));
}
