// Builds the event-spotlight photos (assets-src/spotlight/spotlight-NN.*) into WebP for the
// WebGL gallery: a 1200 px tall copy for phones and the fallback strip, and a 2160 px tall
// (4K-class) copy for the WebGL textures.
// Sources from the old website are only ~600 px tall, so they're enlarged to 1200 with a
// Lanczos filter and light sharpening (smoother than letting the GPU stretch them), and the
// 2160 copy is only made from real high-resolution originals. Drop the client's originals in
// with the same names and run `npm run spotlight` again.
import sharp from 'sharp';
import { readdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'assets-src/spotlight';
const OUT = 'public/images';

for (const file of (await readdir(SRC)).filter((f) => /^spotlight-\d+\.(jpe?g|png|webp)$/i.test(f)).sort()) {
  const name = path.parse(file).name;
  const input = path.join(SRC, file);
  const { width, height } = await sharp(input).metadata();
  const write = async (h, enlarge) => {
    const out = path.join(OUT, `${name}-${h}.webp`);
    await sharp(input)
      .rotate()
      .resize({ height: h, kernel: 'lanczos3', withoutEnlargement: !enlarge })
      .sharpen(enlarge && height < h ? { sigma: 0.8, m1: 0.6, m2: 1.4 } : { sigma: 0.4 })
      .webp({ quality: enlarge && height < h ? 90 : 84, effort: 6, smartSubsample: true })
      .toFile(out);
    return out;
  };
  const small = await write(1200, true);
  const big = path.join(OUT, `${name}-2160.webp`);
  // Only originals tall enough earn a real 4K-class texture; otherwise reuse the 1200 copy
  if (height >= 1600) await write(2160, false);
  else await copyFile(small, big);
  console.log(`${name}: source ${width}x${height} -> 1200 (${Math.round((await stat(small)).size / 1024)} KB), 2160 ${height >= 1600 ? 'from original' : '= 1200 copy (send originals for 4K)'}`);
}
