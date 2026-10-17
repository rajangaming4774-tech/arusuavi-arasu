// Removes the solid key-colour background from AI images and writes
//   public/feast/<name>.webp          trimmed transparent cut-outs (photo fallback, lamp, seal)
//   public/feast/3d/<name>.webp       colour + smooth-edge alpha for the 3D meal
//   public/feast/3d/<name>-geo.webp   R = height, G = roughness for the 3D meal
// Sources:
//   assets-ai/*.png       shot on magenta (#FF00FF)  → food, lamp, seal
//   assets-ai/blue/*.png  shot on blue (#0000FF)     → white/orange/red garnish
// Usage: node scripts/cutout.mjs        (everything)
//        node scripts/cutout.mjs --3d   (only the 3D files)
import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { MENU } from '../src/sections/feast-menu.js';

const OUT = 'public/feast';
const OUT_3D = 'public/feast/3d';
const ONLY_3D = process.argv.includes('--3d');
await mkdir(OUT_3D, { recursive: true });

// How strongly a pixel matches the key colour (0 = not at all)
const KEYS = {
  magenta: (r, g, b) => Math.min(r, b) - g,
  blue: (r, g, b) => b - Math.max(r, g),
};
// Remove the key colour's cast from a kept pixel
const DESPILL = {
  magenta: (px, i, k) => { px[i] -= k; px[i + 2] -= k; },
  blue: (px, i, k) => { px[i + 2] -= k; },
};

async function keyed(file, mode) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const spill = new Uint8Array(data.length / 4); // how much key colour was taken out of each kept pixel
  for (let i = 0; i < data.length; i += 4) {
    const key = KEYS[mode](data[i], data[i + 1], data[i + 2]);
    if (key > 0 && key <= 70) spill[i / 4] = key;
    if (key > 70) {
      data[i + 3] = 0;
    } else if (key > 25) {
      data[i + 3] = Math.round(255 * (1 - (key - 25) / 45)); // soft edge
      DESPILL[mode](data, i, key);
    } else if (key > 0) {
      DESPILL[mode](data, i, key);
    }
  }
  return { data, info, spill };
}

/* ---------- Flat cut-outs ---------- */
async function writeFlat(name, src, info) {
  const data = Buffer.from(src);
  // Trim the outermost 4px of every shape: that rim still carries a tint of the
  // key colour, and it smears down the sides of the 3D mounds.
  const { width: W, height: H } = info;
  const alpha = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = data[p * 4 + 3];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!alpha[y * W + x]) continue;
      let edge = false;
      for (let dy = -4; dy <= 4 && !edge; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || !alpha[yy * W + xx]) { edge = true; break; }
        }
      if (edge) data[(y * W + x) * 4 + 3] = 0;
    }
  const width = { leaf: 1600, lamp: 1200, 'hand-ladle': 1264, 'hand-place': 1264 }[name] || 640;
  await sharp(data, { raw: info })
    .trim({ threshold: 1 })
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 5 })
    .toFile(path.join(OUT, `${name}.webp`));
}

/* ---------- 3D files ---------- */
const PAD = 0.06; // transparent margin around the shape, as a share of its longer side (feast3d.js reads the same number)
const INSET = 3; // px: the outline sits this far inside the keyed edge, clear of the tinted rim
const MARGIN = 120; // px of working room around the source image

// How each shape rises from its outline
//   heap   spooned food: thin at the rim, fuller toward the middle
//   whole  solid items with a round cross-section (vadai ring, banana, fingers)
//   flat   thin crisp things (appalam, leaves)
//   bowl   served in a katori: the surface is liquid, no height
const SHAPES = {
  ...Object.fromEntries(MENU.map((d) => [d.id, d.kind === 'bowl' ? 'bowl' : d.flat ? 'flat' : d.shape || 'heap'])),
  marigold: 'heap', jasmine: 'whole', chilli: 'whole', curryleaf: 'flat', 'hand-place': 'whole', leaf: 'none',
};
// Per-dish strength of the piece-level bumps (1 = default)
const BUMPS = Object.fromEntries(MENU.map((d) => [d.id, d.bumps ?? 1]));
const MAX_SIDE = { leaf: 1700, 'hand-place': 1300 };

const smoothstep = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Exact Euclidean distance to the nearest `true` pixel (Felzenszwalb & Huttenlocher)
function distanceTo(mask, W, H) {
  const INF = 1e20;
  const d = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] ? 0 : INF;
  const n = Math.max(W, H);
  const f = new Float64Array(n), out = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  const pass = (len, get, set) => {
    for (let q = 0; q < len; q++) f[q] = get(q);
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      for (;;) {
        const p = v[k];
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
        if (s <= z[k] && k > 0) k--; else break;
      }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      const p = v[k];
      out[q] = (q - p) * (q - p) + f[p];
    }
    for (let q = 0; q < len; q++) set(q, out[q]);
  };
  for (let x = 0; x < W; x++) pass(H, (y) => d[y * W + x], (y, val) => (d[y * W + x] = val));
  for (let y = 0; y < H; y++) pass(W, (x) => d[y * W + x], (x, val) => (d[y * W + x] = val));
  const r = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) r[i] = Math.sqrt(d[i]);
  return r;
}

// Three box blurs ≈ one Gaussian
function blur(src, W, H, r) {
  r = Math.max(1, Math.round(r));
  let a = Float32Array.from(src), b = new Float32Array(W * H);
  const win = 2 * r + 1;
  for (let n = 0; n < 3; n++) {
    for (let y = 0; y < H; y++) {
      let s = 0;
      const row = y * W;
      for (let x = -r; x <= r; x++) s += a[row + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) {
        b[row + x] = s / win;
        s += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += b[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) {
        a[y * W + x] = s / win;
        s += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x];
      }
    }
  }
  return a;
}

// Spread the colour of the shape outward so no background shows at any zoom or mip level
function bleed(rgb, solid, W, H) {
  const filled = Uint8Array.from(solid);
  let wave = [];
  for (let i = 0; i < W * H; i++) if (filled[i]) wave.push(i);
  const mark = new Int32Array(W * H).fill(-1);
  for (let step = 0; wave.length; step++) {
    const next = [];
    for (const i of wave) {
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (!filled[j] && mark[j] !== step) { mark[j] = step; next.push(j); }
        }
    }
    for (const j of next) {
      const x = j % W, y = (j / W) | 0;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const k = yy * W + xx;
          if (filled[k]) { r += rgb[k * 3]; g += rgb[k * 3 + 1]; b += rgb[k * 3 + 2]; n++; }
        }
      rgb[j * 3] = r / n; rgb[j * 3 + 1] = g / n; rgb[j * 3 + 2] = b / n;
    }
    for (const j of next) filled[j] = 1;
    wave = next;
  }
}

// Connected pieces of the shape, with the deepest point of each (its half-thickness)
function pieces(inside, depth, W, H) {
  const label = new Int32Array(W * H).fill(-1);
  const deepest = [];
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!inside[s] || label[s] >= 0) continue;
    const id = deepest.length;
    let max = 0;
    label[s] = id; stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      if (depth[i] > max) max = depth[i];
      const x = i % W;
      for (const j of [i - W, i + W, x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < W * H && inside[j] && label[j] < 0) { label[j] = id; stack.push(j); }
      }
    }
    deepest.push(max);
  }
  return { label, deepest };
}

async function write3D(name, src, info, spill, mode) {
  const shape = SHAPES[name];
  // Work on a roomier canvas so the margin never runs off the source image
  const W = info.width + 2 * MARGIN, H = info.height + 2 * MARGIN;
  const rgb = new Float32Array(W * H * 3);
  const inside0 = new Uint8Array(W * H), outside0 = new Uint8Array(W * H).fill(1);
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const s = (y * info.width + x) * 4, i = (y + MARGIN) * W + x + MARGIN;
      // Solid pixels that only caught the backdrop's bounce light (a pink cast on white rice) were darkened
      // when the cast was subtracted. Lift them back to their own brightness.
      const k = spill[s / 4];
      rgb[i * 3] = Math.min(255, src[s] + k); rgb[i * 3 + 1] = Math.min(255, src[s + 1] + k); rgb[i * 3 + 2] = Math.min(255, src[s + 2] + k);
      if (src[s + 3] >= 128) { inside0[i] = 1; outside0[i] = 0; }
    }

  // Signed distance to the outline (positive inside), smoothed so the pixel staircase is gone
  const dIn = distanceTo(outside0, W, H), dOut = distanceTo(inside0, W, H);
  let sd = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) sd[i] = (inside0[i] ? dIn[i] - 0.5 : 0.5 - dOut[i]) - INSET;
  sd = blur(sd, W, H, 1);

  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (sd[y * W + x] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const pad = Math.round(PAD * Math.max(cw, ch));
  if (pad > MARGIN) throw new Error(`${name}: margin too small for padding ${pad}`);
  const spread = Math.min(24, pad * 0.7);

  // Pale foods (rice, curd) pick up a pink blush near their edge from the magenta backdrop that
  // the key can't see, because it is redder than the key colour. Neutralise it, fading out inward.
  if (mode === 'magenta') {
    for (let i = 0; i < W * H; i++) {
      if (sd[i] < -2 || sd[i] > 45) continue;
      const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
      const max = Math.max(r, g, b);
      if (max < 150 || (max - Math.min(r, g, b)) / max > 0.2 || g > r || g > b + 4) continue;
      const w = 0.9 * (1 - smoothstep(sd[i], 10, 45));
      const dr = (r - g) * w, db = Math.max(0, b - g) * w;
      const lift = dr * 0.3 + db * 0.11; // keep the brightness the cast was adding
      rgb[i * 3] = r - dr + lift; rgb[i * 3 + 1] = g + lift; rgb[i * 3 + 2] = b - db + lift;
    }
  }

  // Colour: trusted pixels are a little inside the outline; everything else takes its nearest neighbour's colour
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = sd[i] > 1 ? 1 : 0;
  bleed(rgb, solid, W, H);

  const inside = new Uint8Array(W * H);
  const depth = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) { inside[i] = sd[i] > 0 ? 1 : 0; depth[i] = Math.max(0, sd[i]); }

  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = (rgb[i * 3] * 0.3 + rgb[i * 3 + 1] * 0.59 + rgb[i * 3 + 2] * 0.11) / 255;
  const lumFine = blur(lum, W, H, 1), lumWide = blur(lum, W, H, 12);

  // ---- Height ----
  let height = new Float32Array(W * H);
  if (shape === 'heap' || shape === 'whole' || shape === 'flat') {
    const { label, deepest } = pieces(inside, depth, W, H);
    const deepestOfAll = deepest.reduce((a, b) => Math.max(a, b), 1);
    for (let i = 0; i < W * H; i++) {
      if (!inside[i]) continue;
      const R = deepest[label[i]] || 1;
      const t = Math.min(1, depth[i] / R);
      const size = R / deepestOfAll; // small pieces stay low
      if (shape === 'heap') height[i] = size ** 0.8 * (1 - (1 - t) ** 2.2);
      else if (shape === 'whole') height[i] = size * Math.sqrt(1 - (1 - t) ** 2);
      else height[i] = smoothstep(depth[i], 0, 4);
    }
    // Soften the creases a distance field leaves along the middle of every shape, then pin the outline back to zero
    height = blur(height, W, H, Math.max(2, 0.012 * Math.max(cw, ch)));
    const detail = { heap: 0.11, whole: 0.035, flat: 0.3 }[shape] * (BUMPS[name] ?? 1);
    for (let i = 0; i < W * H; i++) {
      const bumps = Math.max(-1, Math.min(1, (lumFine[i] - lumWide[i]) * 4)); // bright grains stand proud, dark gaps sink
      height[i] = Math.max(0, 0.86 * height[i] + detail * bumps * smoothstep(depth[i], 0, 10)) * smoothstep(depth[i], 0, 3);
    }
  }

  // ---- Roughness: glossy where the photo shows a wet or oily highlight ----
  const rough = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const max = Math.max(r, g, b), sat = max ? (max - Math.min(r, g, b)) / max : 0;
    const highlight = Math.min(1, Math.max(0, (lumFine[i] - lumWide[i]) * 3.5 - 0.12)) * (1 - 0.5 * sat);
    rough[i] = 1 - 0.6 * highlight;
  }
  const roughSoft = blur(rough, W, H, 1);

  // ---- Crop to the shape plus its margin and write ----
  const left = x0 - pad, top = y0 - pad, ow = cw + 2 * pad, oh = ch + 2 * pad;
  const colour = Buffer.alloc(ow * oh * 3), alpha = Buffer.alloc(ow * oh), geo = Buffer.alloc(ow * oh * 3);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      const i = (y + top) * W + x + left, o = y * ow + x;
      colour[o * 3] = rgb[i * 3]; colour[o * 3 + 1] = rgb[i * 3 + 1]; colour[o * 3 + 2] = rgb[i * 3 + 2];
      // Distance-field alpha: 50% is the outline. The floor keeps WebP from discarding the colour underneath.
      alpha[o] = Math.max(20, Math.round(255 * Math.min(1, Math.max(0, 0.5 + sd[i] / (2 * spread)))));
      geo[o * 3] = Math.round(255 * Math.min(1, height[i]));
      geo[o * 3 + 1] = Math.round(255 * roughSoft[i]);
    }
  const side = MAX_SIDE[name] || 720;
  const fit = { width: side, height: side, fit: 'inside', withoutEnlargement: true };
  // Colour and alpha are resized apart: resizing them together would premultiply the colour by the distance field
  const colourSmall = await sharp(colour, { raw: { width: ow, height: oh, channels: 3 } }).resize(fit).raw().toBuffer({ resolveWithObject: true });
  const alphaSmall = await sharp(alpha, { raw: { width: ow, height: oh, channels: 1 } }).resize(fit).toColourspace('b-w').raw().toBuffer();
  await sharp(colourSmall.data, { raw: colourSmall.info })
    .joinChannel(alphaSmall, { raw: { width: colourSmall.info.width, height: colourSmall.info.height, channels: 1 } })
    .webp({ quality: 86, alphaQuality: 100, effort: 5 })
    .toFile(path.join(OUT_3D, `${name}.webp`));
  if (shape !== 'none') {
    await sharp(geo, { raw: { width: ow, height: oh, channels: 3 } })
      .resize({ width: 320, height: 320, fit: 'inside' })
      .webp({ lossless: true, effort: 5 })
      .toFile(path.join(OUT_3D, `${name}-geo.webp`));
  }
}

async function cut(dir, mode) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.png'));
  for (const file of files) {
    const name = path.parse(file).name;
    const { data, info, spill } = await keyed(path.join(dir, file), mode);
    if (!ONLY_3D) { await writeFlat(name, data, info); console.log('cut', name); }
    if (SHAPES[name]) { await write3D(name, data, info, spill, mode); console.log('3d ', name, SHAPES[name]); }
  }
}

await cut('assets-ai', 'magenta');
await cut('assets-ai/blue', 'blue');
