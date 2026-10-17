// Turns the Figma AI Chettinad hall images (assets-ai/chettinad/*.png) into web textures for the
// "Notable celebrations" wall, written to public/images/chettinad/:
//   plaster.webp   lime-plaster wall, lightened and mirrored into a seamless tile
//   upper.webp     teak ceiling, studded beam and painted border (mirrored to tile left-right)
//   wainscot.webp  teak panelling (mirrored to tile left-right)
//   athangudi.webp tiled floor
//   teak.webp      polished teak grain for the 3D pillars, mirrored into a seamless tile
//   pillar.webp    teak pillar cut out of its magenta backdrop, trimmed
//   frame.webp     teak picture frame cut out (inside and outside), trimmed; prints its opening
// Usage: node scripts/chettinad.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = 'assets-ai/chettinad';
const OUT = 'public/images/chettinad';
await mkdir(OUT, { recursive: true });

// Join an image with its mirror so the seam always matches (both axes, or left-right only)
async function mirrored(input, { both = false } = {}) {
  const img = sharp(await input.png().toBuffer());
  const { width: w, height: h } = await img.metadata();
  const a = await img.clone().png().toBuffer();
  const b = await img.clone().flop().png().toBuffer();
  const parts = [{ input: a, left: 0, top: 0 }, { input: b, left: w, top: 0 }];
  if (both) {
    parts.push({ input: await img.clone().flip().png().toBuffer(), left: 0, top: h });
    parts.push({ input: await img.clone().flip().flop().png().toBuffer(), left: w, top: h });
  }
  return sharp({ create: { width: w * 2, height: both ? h * 2 : h, channels: 3, background: '#000' } }).composite(parts);
}

// Magenta key: transparent where the pixel is magenta, soft edge, spill removed
async function keyed(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const k = Math.min(data[i], data[i + 2]) - data[i + 1];
    if (k > 90) data[i + 3] = 0;
    else if (k > 30) data[i + 3] = Math.round(255 * (1 - (k - 30) / 60));
    if (k > 0 && k <= 90) { const s = Math.min(k, 60); data[i] -= s; data[i + 2] -= s; }
  }
  return { data, info };
}
const fromRaw = ({ data, info }) => sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });

// Plaster: brighter, less yellow, mirrored both ways
await (await mirrored(sharp(`${SRC}/plaster.png`).resize(900).modulate({ brightness: 1.1, saturation: 0.65 }), { both: true }))
  .webp({ quality: 74 }).toFile(`${OUT}/plaster.webp`);

// Upper band: ceiling, beam and painted border (the top 60% of the image)
await (await mirrored(sharp(`${SRC}/upper.png`).extract({ left: 0, top: 0, width: 2064, height: 304 }).resize(1032)))
  .webp({ quality: 80 }).toFile(`${OUT}/upper.webp`);

// Wainscot
await (await mirrored(sharp(`${SRC}/wainscot.png`).resize(1032)))
  .webp({ quality: 80 }).toFile(`${OUT}/wainscot.webp`);

// Teak grain for the 3D pillars
await (await mirrored(sharp(`${SRC}/teak.png`).resize(512), { both: true }))
  .webp({ quality: 80 }).toFile(`${OUT}/teak.webp`);

// Floor
await sharp(`${SRC}/athangudi.png`).resize(768).webp({ quality: 80 }).toFile(`${OUT}/athangudi.webp`);

// Pillar
{
  const trimmed = await fromRaw(await keyed(`${SRC}/pillar.png`)).png().toBuffer();
  const out = sharp(trimmed).trim({ threshold: 1 });
  const { info } = await out.clone().toBuffer({ resolveWithObject: true });
  await sharp(trimmed).trim({ threshold: 1 }).resize({ height: 1400 }).webp({ quality: 82, alphaQuality: 90 }).toFile(`${OUT}/pillar.webp`);
  console.log('pillar', info.width, 'x', info.height, 'ratio', (info.width / info.height).toFixed(4));
}

// Frame: cut out, trim, then find the opening (transparent area in the middle) as fractions
{
  const k = await keyed(`${SRC}/frame.png`);
  const trimmedBuf = await fromRaw(k).trim({ threshold: 1 }).png().toBuffer();
  const { data, info } = await sharp(trimmedBuf).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, cy = H >> 1, cx = W >> 1;
  const a = (x, y) => data[(y * W + x) * 4 + 3];
  let l = cx, r = cx, t = cy, b = cy;
  while (l > 0 && a(l - 1, cy) < 128) l--;
  while (r < W - 1 && a(r + 1, cy) < 128) r++;
  while (t > 0 && a(cx, t - 1) < 128) t--;
  while (b < H - 1 && a(cx, b + 1) < 128) b++;
  console.log('frame', W, 'x', H, 'opening', {
    left: (l / W).toFixed(4), right: ((W - 1 - r) / W).toFixed(4), top: (t / H).toFixed(4), bottom: ((H - 1 - b) / H).toFixed(4),
  });
  await sharp(trimmedBuf).resize(1000).webp({ quality: 82, alphaQuality: 90 }).toFile(`${OUT}/frame.webp`);
}
