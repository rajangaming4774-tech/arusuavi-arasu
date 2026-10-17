import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MENU, HOT } from './feast-menu.js';

/*
 * Real-time 3D wedding dining hall (pandhi) for the home hero.
 *
 * Setting   A long red table with a gold kolam under every place, a banana leaf
 *           at each, marigolds and jasmine around it, a brass water tumbler,
 *           gold dust and petals drifting down. The hall is dark: a brass
 *           kuthuvilakku stands by our leaf, every other place has its own small
 *           flame and pool of lamplight. Scrolling moves one slow camera through
 *           four chapters: the lamp, the lamplit meal, the hall, the hall from
 *           above. Only the places nearest the camera are built in full 3D; the
 *           rest are flat copies photographed from above at start-up.
 * Leaf      Curved and waxy (clearcoat) with raised veins, sprinkled with water
 *           droplets before the meal is served.
 * Dishes    Each one is a height field with its own baked shape (rings for vadai,
 *           a tube for the banana, ragged low mounds for spooned food), a relief
 *           map from its photo so grains and lentils catch the light, and a
 *           roughness map so only the wet parts shine. Edges come from a distance
 *           field, so they stay smooth however close the camera gets.
 *           Katoris and the serving ladle are lathe-turned stainless steel.
 *           The shape, edge and roughness maps are baked by scripts/cutout.mjs.
 *
 * Scroll drives `state` (t = chapter, light, fall) from hero.js.
 */

const LEAF_W = 10;
const LEAF_D = (LEAF_W * 555) / 1315;
const DEG = Math.PI / 180;
const PAD = 0.06; // transparent margin baked around every cut-out (same number as scripts/cutout.mjs)
const { smoothstep, clamp, lerp } = THREE.MathUtils;

// Gentle curvature: edges curl up, midrib slightly raised.
export function leafHeight(x, z) {
  const nx = x / (LEAF_W / 2), nz = z / (LEAF_D / 2);
  return 0.17 * nz * nz + 0.05 * nx * nx + 0.02 * Math.sin(x * 1.4) * nz * nz + 0.022 * Math.exp(-((z / 0.06) ** 2));
}

const toWorld = (d) => ({
  x: (d.x / 100 - 0.5) * LEAF_W,
  z: (d.y / 100 - 0.5) * LEAF_D,
  w: (d.w / 100) * LEAF_W,
});

// Deterministic pseudo-random so the styling is identical on every visit
const rand = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function colorTexture(img, renderer) {
  const t = new THREE.Texture(img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.needsUpdate = true;
  return t;
}

function dataTexture(img) {
  const t = new THREE.Texture(img);
  t.needsUpdate = true;
  return t;
}

// A baked cut-out: colour (alpha = distance to the outline) plus its height/roughness map
async function loadCutout(id, renderer, geo = true) {
  const [img, geoImg] = await Promise.all([loadImage(`/feast/3d/${id}.webp`), geo ? loadImage(`/feast/3d/${id}-geo.webp`) : null]);
  return { img, tex: colorTexture(img, renderer), geoImg, geoTex: geoImg && dataTexture(geoImg) };
}

// The shape's own proportions, and how much larger the padded image is than the shape
function frame(img) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const pad = (PAD * Math.max(iw, ih)) / (1 + 2 * PAD);
  const cw = iw - 2 * pad, ch = ih - 2 * pad;
  return { aspect: ch / cw, sx: iw / cw, sy: ih / ch };
}

function pixels(img, W, H = W) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H).data;
}

// Relief (normal) map from the photo's own light and dark detail.
function reliefTexture(img, strength = 2, N = 256) {
  const src = pixels(img, N);
  const lum = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) lum[i] = (src[i * 4] * 0.3 + src[i * 4 + 1] * 0.59 + src[i * 4 + 2] * 0.11) / 255;
  const out = new Uint8ClampedArray(N * N * 4);
  const at = (x, y) => lum[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      out[i] = (-dx / len * 0.5 + 0.5) * 255;
      out[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      out[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  const c = document.createElement('canvas');
  c.width = c.height = N;
  c.getContext('2d').putImageData(new ImageData(out, N, N), 0, 0);
  return new THREE.CanvasTexture(c);
}

/*
 * Food shaped from its baked height map.
 * spec: { w (world width of the shape), h, gloss, flat, seed, relief, grid (cells across, optional), at: {x, z} on the leaf }
 * quality scales the grid (phones get a coarser one).
 */
function heapMesh(spec, cut, quality = 1) {
  const { aspect, sx, sy } = frame(cut.img);
  const ww = spec.w * sx, wd = spec.w * aspect * sy;
  // Finer grids for bigger dishes, never more cells than the shape can use
  let nx = clamp(Math.round((spec.grid || spec.w * 85 + 24) * quality), 24, 160);
  let nz = Math.max(16, Math.round((nx * wd) / ww));
  const over = Math.sqrt((nx * nz) / 20000);
  if (over > 1) { nx = Math.round(nx / over); nz = Math.round(nz / over); }
  const map = pixels(cut.geoImg, nx, nz);
  const geo = new THREE.PlaneGeometry(ww, wd, nx - 1, nz - 1);
  geo.rotateX(-Math.PI / 2); // image top → far side (-z)
  const pos = geo.attributes.position;
  const peak = spec.h * spec.w;
  const seed = spec.seed || 1;
  // No two spoonfuls land alike: each mound leans its own way
  const lean = rand(seed + 7) * Math.PI * 2, lx = Math.cos(lean), lz = Math.sin(lean);
  const base = spec.at ? leafHeight(spec.at.x, spec.at.z) : 0;
  for (let iz = 0; iz < nz; iz++)
    for (let ix = 0; ix < nx; ix++) {
      const i = iz * nx + ix;
      const m = map[i * 4] / 255; // 0 at the outline, so the rim meets the leaf
      const u = ix / (nx - 1) - 0.5, v = iz / (nz - 1) - 0.5;
      let y;
      if (spec.flat) {
        // Thin crisp shapes (appalam, leaves): a plate with a gentle warp
        y = peak * m + smoothstep(m, 0.2, 0.8) * 0.02 * spec.w * Math.sin(u * 17 + seed) * Math.cos(v * 14);
      } else {
        y = peak * m * (1 + 0.38 * (u * lx + v * lz) + 0.05 * Math.sin(u * 19 + seed) * Math.cos(v * 15 + seed * 0.5));
      }
      // Follow the curl of the leaf underneath
      if (spec.at) y += leafHeight(spec.at.x + pos.getX(i), spec.at.z + pos.getZ(i)) - base;
      pos.setY(i, y + 0.004);
    }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: cut.tex, alphaTest: 0.5, alphaToCoverage: true, side: spec.flat ? THREE.DoubleSide : THREE.FrontSide, shadowSide: THREE.DoubleSide,
    normalMap: reliefTexture(cut.img, spec.relief ?? 2.6, quality < 1 ? 256 : 384), normalScale: new THREE.Vector2(1, 1),
    roughnessMap: cut.geoTex, roughness: 0.96 - spec.gloss * 0.5, metalness: 0, envMapIntensity: 0.15 + spec.gloss * 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, top: peak, aspect };
}

const lathe = (profile, r) => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x * r, y * r)), 72);
const KATORI = [
  [0, 0], [0.7, 0], [0.8, 0.03], [0.9, 0.15], [0.97, 0.32], [1.0, 0.46],
  [0.985, 0.49], [0.945, 0.475], [0.885, 0.33], [0.79, 0.16], [0.68, 0.085], [0, 0.085],
];
const TUMBLER = [
  [0, 0], [0.74, 0], [0.8, 0.04], [0.84, 0.6], [0.92, 1.7], [1.0, 2.05], [1.04, 2.1],
  [0.98, 2.1], [0.9, 1.7], [0.8, 0.6], [0.74, 0.12], [0, 0.12],
];
const steel = new THREE.MeshStandardMaterial({ color: 0xd9dbdf, metalness: 1, roughness: 0.16, envMapIntensity: 1.5 });

function bowlMesh(spec, cut) {
  const r = spec.w / 2;
  const bowl = new THREE.Mesh(lathe(KATORI, r), steel);
  bowl.castShadow = bowl.receiveShadow = true;

  // Curry surface: the inner part of the photo, set just below the rim.
  // Tempering, onions and cashews keep their own relief and sheen on top of the liquid.
  const { sx, sy } = frame(cut.img);
  const crop = (t) => { t.repeat.set(0.84 / sx, 0.84 / sy); t.offset.set((1 - 0.84 / sx) / 2, (1 - 0.84 / sy) / 2); t.needsUpdate = true; return t; };
  const liquid = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.905, 64).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      map: crop(cut.tex.clone()), normalMap: crop(reliefTexture(cut.img, 1.8, 384)), normalScale: new THREE.Vector2(0.7, 0.7),
      roughnessMap: crop(cut.geoTex.clone()), roughness: 0.42, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.5,
    }),
  );
  liquid.position.y = r * 0.37;
  liquid.receiveShadow = true;
  const g = new THREE.Group();
  g.add(bowl, liquid);
  return { mesh: g, top: r * 0.49, aspect: 1 };
}

function softDot(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// One place on the table: deep lacquered red with a gold kolam. Tiled once per place setting.
function tableTexture(renderer, S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const bg = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  bg.addColorStop(0, '#5a0a10');
  bg.addColorStop(0.55, '#44070c');
  bg.addColorStop(1, '#36060a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Kolam: rings of dots joined by looping petals, drawn in soft gold
  ctx.translate(S / 2, S / 2);
  const gold = (a) => `rgba(236, 190, 96, ${a * 0.8})`;
  ctx.lineCap = 'round';
  const k = S / 2048; // line weights below were chosen on a 2048 canvas
  const ring = (r, n, dot, a) => {
    ctx.fillStyle = gold(a);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(t) * r, Math.sin(t) * r, dot, 0, Math.PI * 2); ctx.fill();
    }
  };
  const petals = (r0, r1, n, width, a, lw) => {
    ctx.strokeStyle = gold(a); ctx.lineWidth = lw * k;
    for (let i = 0; i < n; i++) {
      ctx.save(); ctx.rotate((i / n) * Math.PI * 2);
      ctx.beginPath(); ctx.moveTo(0, -r0);
      ctx.bezierCurveTo(width, -(r0 + r1) / 2, width * 0.6, -r1, 0, -r1);
      ctx.bezierCurveTo(-width * 0.6, -r1, -width, -(r0 + r1) / 2, 0, -r0);
      ctx.stroke(); ctx.restore();
    }
  };
  const circle = (r, a, lw, dash) => { ctx.strokeStyle = gold(a); ctx.lineWidth = lw * k; ctx.setLineDash((dash || []).map((v) => v * k)); ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); };
  const u = S / 24; // texture pixels per world unit: the kolam spans most of the place setting
  circle(5.9 * u, 0.5, 3);
  circle(6.15 * u, 0.3, 1.5, [2, 10]);
  petals(6.2 * u, 7.5 * u, 24, 1.0 * u, 0.5, 3);
  petals(6.2 * u, 6.9 * u, 24, 0.5 * u, 0.3, 2);
  ring(7.75 * u, 24, 0.07 * u, 0.6);
  circle(8.2 * u, 0.32, 2);
  petals(8.25 * u, 9.3 * u, 48, 0.55 * u, 0.3, 2);
  ring(9.6 * u, 96, 0.035 * u, 0.4);
  circle(9.95 * u, 0.2, 1.5, [1, 8]);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Fine parallel veins for the leaf's waxy top coat, so the surface holds detail in close-up
function veinTexture() {
  const W = 1024, c = document.createElement('canvas');
  c.width = W; c.height = 4;
  const h = new Float32Array(W);
  for (let x = 0; x < W; x++) h[x] = 0.5 * Math.sin(x * 0.61) + 0.3 * Math.sin(x * 0.23 + 1.3) + 0.5 * (rand(x) - 0.5);
  const img = new ImageData(W, 4);
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < W; x++) {
      const dx = (h[(x + 1) % W] - h[(x + W - 1) % W]) * 1.2, len = Math.hypot(dx, 1);
      img.data.set([(-dx / len * 0.5 + 0.5) * 255, 127.5, (1 / len * 0.5 + 0.5) * 255, 255], (y * W + x) * 4);
    }
  c.getContext('2d').putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 1);
  return t;
}

// Flowers and spices styled around the leaf (table coordinates)
const DECOR = [
  ['marigold', -5.75, -2.2, 1.35], ['marigold', -4.75, -2.85, 1.0], ['jasmine', -5.0, -1.5, 0.5], ['jasmine', -6.2, -1.35, 0.44],
  ['jasmine', -3.95, -3.0, 0.46], ['curryleaf', -6.3, -3.0, 0.95],
  ['marigold', 5.65, 2.3, 1.3], ['marigold', 4.7, 2.9, 0.95], ['jasmine', 6.1, 1.45, 0.5], ['jasmine', 3.85, 3.0, 0.44],
  ['jasmine', 5.2, 1.5, 0.4], ['chilli', 6.3, 3.0, 1.0], ['curryleaf', 3.9, 2.3, 0.8],
  ['chilli', -5.5, 2.25, 1.05], ['chilli', -4.6, 2.8, 0.9], ['curryleaf', -6.15, 1.7, 0.85], ['curryleaf', -3.9, 2.85, 0.8], ['jasmine', -5.15, 1.45, 0.45],
  ['jasmine', 5.55, -2.75, 0.46], ['curryleaf', 5.9, -1.2, 0.8], ['jasmine', 6.3, -2.0, 0.4],
];
const DECOR_SHAPE = {
  marigold: { h: 0.36, gloss: 0.25, relief: 3, grid: 64 },
  jasmine: { h: 0.14, gloss: 0.3, relief: 1.2, grid: 40 },
  curryleaf: { h: 0.03, gloss: 0.75, flat: true, relief: 2.5, grid: 36 },
  chilli: { h: 0.16, gloss: 0.8, relief: 2.5, grid: 48 },
};

// ---- The dining hall ----
const SPACING = 11.5; // one leaf and its place setting, measured along the row
const ROWS = Array.from({ length: 20 }, (_, i) => i - 16); // rows of diners, z = row × SPACING; row 0 is ours
const COL_MIN = -40, COL_MAX = 60; // places along each row, as multiples of SPACING
const NEAR_ROWS = [0, -1]; // rows built in full 3D around our leaf; the rest of the hall is flat copies
const SNAP_D = 7.5; // depth of the flat copy of a place setting (leaf plus its flowers)
const LAMP_AT = { x: -5.6, z: -3.4, h: 4.4 }; // the brass lamp stands beyond the tip of our leaf
const DARK = 0x150306;

export async function createFeast3D(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'feast__canvas';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const mobile = window.innerWidth < 768;
  const quality = mobile ? 0.45 : 0.7;
  const NEAR_COLS = mobile ? [-1, 0, 1] : [-2, -1, 0, 1, 2];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps food colours true
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  const fog = new THREE.Fog(DARK, 26, 110); // the hall melts into the dark
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  // A dim hall. A warm key light with long shadows, a cool rim, and a pool of lamplight over our leaf.
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x1a0d08, 0.07));
  const sun = new THREE.DirectionalLight(0xffdcae, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 14, bottom: -5, near: 1, far: 50 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.3);
  rim.position.set(6, 5, -8);
  scene.add(rim);
  const pool = new THREE.SpotLight(0xffd59a, 0, 40, 0.5, 0.75, 1.4);
  pool.position.set(1.5, 11, 4);
  pool.target.position.set(0, 0, -0.5);
  scene.add(pool, pool.target);

  const hall = new THREE.Group();
  scene.add(hall);

  // ---- The long table: dark red cloth with a gold kolam under every place ----
  const GX = 1400, GZ = 400;
  const tableTex = tableTexture(renderer, mobile ? 1024 : 2048);
  tableTex.repeat.set(GX / SPACING, GZ / SPACING);
  tableTex.offset.set(0.5 - ((GX / SPACING / 2) % 1), 0.5 - ((GZ / SPACING / 2) % 1)); // a kolam centred on every place
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GX, GZ).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ map: tableTex, roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.4, envMapIntensity: 0.1 }),
  );
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Leaf ----
  const leafCut = await loadCutout('leaf', renderer, false);
  const leafFrame = frame(leafCut.img);
  const mirror = (t) => { t.repeat.x = -1; t.offset.x = 1; return t; }; // tip to the diner's left, as served
  const leafTex = mirror(leafCut.tex);
  const leafGeo = new THREE.PlaneGeometry(LEAF_W * leafFrame.sx, LEAF_D * leafFrame.sy, mobile ? 90 : 150, mobile ? 44 : 72).rotateX(-Math.PI / 2);
  const lp = leafGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) lp.setY(i, leafHeight(lp.getX(i), lp.getZ(i)));
  leafGeo.computeVertexNormals();
  const leafProto = new THREE.Mesh(leafGeo, new THREE.MeshPhysicalMaterial({
    map: leafTex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide,
    normalMap: mirror(reliefTexture(leafCut.img, 3, 1024)), normalScale: new THREE.Vector2(-0.7, 0.7),
    roughness: 0.48, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.32, envMapIntensity: 0.3,
    clearcoatNormalMap: veinTexture(), clearcoatNormalScale: new THREE.Vector2(0.35, 0.35),
  }));
  leafProto.castShadow = leafProto.receiveShadow = true;

  // Soft dark patch under each dish, so food sits on the leaf rather than floating over it
  const contactTex = softDot(128, [[0, 'rgba(10,22,4,0.62)'], [0.62, 'rgba(10,22,4,0.4)'], [1, 'rgba(10,22,4,0)']]);
  function contactProto(x, z, w, aspect) {
    const geo = new THREE.PlaneGeometry(w * 1.34, w * aspect * 1.34 + 0.12, 10, 10).rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, leafHeight(x + p.getX(i), z + p.getZ(i)) + 0.008);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false }));
    m.position.set(x, 0, z);
    m.renderOrder = 1;
    return m;
  }

  // ---- Dishes: one shape each, shared by every place in the hall ----
  const steamTex = softDot(128, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  const protos = await Promise.all(MENU.map(async (d, i) => {
    const cut = await loadCutout(d.id, renderer);
    const { x, z, w } = toWorld(d);
    const spec = { ...d, w, seed: i * 1.7 + 1, at: { x, z } };
    const { mesh, top, aspect } = d.kind === 'bowl' ? bowlMesh(spec, cut) : heapMesh(spec, cut, quality);
    return { data: d, mesh, blob: contactProto(x, z, w, aspect), x, z, w, top, hot: HOT.has(d.id) };
  }));

  // ---- Brass tumbler of water ----
  const brass = new THREE.MeshStandardMaterial({ color: 0xe0a94a, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
  const tumblerProto = new THREE.Group();
  {
    const r = 0.34;
    const cup = new THREE.Mesh(lathe(TUMBLER, r), brass);
    cup.castShadow = cup.receiveShadow = true;
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.95, 48).rotateX(-Math.PI / 2),
      new THREE.MeshPhysicalMaterial({ color: 0x9fb8c4, roughness: 0.03, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2 }),
    );
    water.position.y = r * 1.86;
    tumblerProto.add(cup, water);
    tumblerProto.position.set(4.25, 0, -1.85);
  }

  // ---- Flowers and spices styled around each leaf: one shaped mesh per kind ----
  const garnish = {};
  await Promise.all(Object.keys(DECOR_SHAPE).map(async (id, i) => {
    const cut = await loadCutout(id, renderer);
    garnish[id] = { cut, ...heapMesh({ ...DECOR_SHAPE[id], w: 1, seed: i * 2.3 + 1 }, cut, quality) };
  }));

  /*
   * A place setting: leaf, the full meal, flowers and tumbler. Built once per near place;
   * everything inside is shared geometry. Returns the steam sprites so they can be animated.
   */
  function makePlace(x, z) {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    hall.add(root);
    root.add(leafProto.clone(), tumblerProto.clone());
    const steam = [];
    for (const p of protos) {
      const group = new THREE.Group();
      group.add(p.mesh.clone());
      group.position.set(p.x, leafHeight(p.x, p.z), p.z);
      root.add(group, p.blob.clone());
      if (p.hot) {
        for (let k = 0; k < 4; k++) {
          const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
          s.userData = { phase: k / 4 + rand(x + z + k) * 0.1, top: p.top, w: p.w };
          group.add(s);
          steam.push(s);
        }
      }
    }
    DECOR.forEach(([id, dx, dz, w], i) => {
      const mesh = new THREE.Mesh(garnish[id].mesh.geometry, garnish[id].mesh.material);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(dx, 0, dz);
      mesh.scale.setScalar(w);
      mesh.rotation.y = rand(i + 40 + x) * Math.PI * 2;
      root.add(mesh);
    });
    return { root, steam };
  }

  // ---- Flat copy of a place setting for the rest of the hall, photographed from above once ----
  const snap = makePlace(0, 0);
  const rtW = mobile ? 768 : 1536, rtH = Math.round((rtW * SNAP_D) / SPACING);
  const ortho = new THREE.OrthographicCamera(-SPACING / 2, SPACING / 2, SNAP_D / 2, -SNAP_D / 2, 1, 80);
  ortho.position.set(0, 40, 0);
  ortho.up.set(0, 0, -1);
  ortho.lookAt(0, 0, 0);
  const rt = new THREE.WebGLRenderTarget(rtW, rtH, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  ground.visible = false;
  scene.fog = null;
  const envSaved = scene.environmentIntensity;
  scene.environmentIntensity = 0.1; // straight down, the room light would white out the steel and curry
  sun.intensity = 2.6;
  sun.position.set(-6, 7.5, 7);
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, ortho);
  renderer.setRenderTarget(null);
  sun.intensity = 1.5;
  scene.environmentIntensity = envSaved;
  scene.fog = fog;
  ground.visible = true;
  hall.remove(snap.root);

  const farGeo = new THREE.PlaneGeometry(SPACING, SNAP_D).rotateX(-Math.PI / 2);
  const farPlaces = [];
  for (const r of ROWS) for (let j = COL_MIN; j <= COL_MAX; j++) if (!(NEAR_ROWS.includes(r) && NEAR_COLS.includes(j))) farPlaces.push([r, j]);
  // The copies are unlit, so they are dimmed to sit in the dark hall; the lamp pools below lift them again.
  const far = new THREE.InstancedMesh(farGeo, new THREE.MeshBasicMaterial({ map: rt.texture, color: 0x5c5c5c, transparent: true, alphaTest: 0.03, depthWrite: false }), farPlaces.length);
  far.position.y = 0.015;
  far.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3(1, 1, 1);
  farPlaces.forEach(([r, j], k) => far.setMatrixAt(k, m4.compose(v3.set(j * SPACING, 0, r * SPACING), q, s3)));
  hall.add(far);

  // ---- The places around our leaf, in full 3D ----
  const steam = [];
  const nearPlaces = [];
  for (const r of NEAR_ROWS) for (const j of NEAR_COLS) { steam.push(...makePlace(j * SPACING, r * SPACING).steam); nearPlaces.push([r, j]); }

  // ---- Lamplight over every other place: a warm pool on the cloth and a small flame above it ----
  const allPlaces = [...farPlaces, ...nearPlaces.filter(([r, j]) => !(r === 0 && j === 0))];
  const poolTex = softDot(256, [[0, 'rgba(255,176,90,0.55)'], [0.35, 'rgba(255,150,70,0.22)'], [1, 'rgba(255,120,50,0)']]);
  const pools = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(SPACING * 1.25, SPACING * 1.25).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
    allPlaces.length,
  );
  pools.position.y = 0.01;
  pools.renderOrder = 1;
  pools.frustumCulled = false;
  allPlaces.forEach(([r, j], k) => pools.setMatrixAt(k, m4.compose(v3.set(j * SPACING, 0, r * SPACING + LAMP_AT.z * 0.5), q, s3)));
  hall.add(pools);
  const flamePos = new Float32Array(allPlaces.length * 3);
  allPlaces.forEach(([r, j], k) => flamePos.set([j * SPACING + LAMP_AT.x, LAMP_AT.h * 0.72, r * SPACING + LAMP_AT.z], k * 3));
  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute('position', new THREE.BufferAttribute(flamePos, 3));
  const flameTex = softDot(64, [[0, 'rgba(255,250,220,1)'], [0.25, 'rgba(255,190,90,0.8)'], [1, 'rgba(255,120,40,0)']]);
  const flames = new THREE.Points(flameGeo, new THREE.PointsMaterial({ map: flameTex, size: 0.9, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
  hall.add(flames);

  // ---- Our brass kuthuvilakku, its flame and the light it throws ----
  const lampImg = await loadImage('/feast/lamp.webp');
  const lampTex = colorTexture(lampImg, renderer);
  const lampW = (LAMP_AT.h * lampImg.naturalWidth) / lampImg.naturalHeight;
  const lamp = new THREE.Mesh(
    new THREE.PlaneGeometry(lampW, LAMP_AT.h),
    new THREE.MeshStandardMaterial({ map: lampTex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.35, metalness: 0.6, envMapIntensity: 0.8, emissive: 0x6a3a08, emissiveIntensity: 0.25 }),
  );
  lamp.position.set(LAMP_AT.x, LAMP_AT.h / 2, LAMP_AT.z);
  lamp.castShadow = true;
  hall.add(lamp);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  flame.position.set(LAMP_AT.x, LAMP_AT.h * 0.72, LAMP_AT.z + 0.05);
  hall.add(flame);
  const lampLight = new THREE.PointLight(0xffb15c, 30, 16, 1.6);
  lampLight.position.copy(flame.position).add(new THREE.Vector3(0, 0.1, 0.4));
  hall.add(lampLight);

  // ---- Water droplets on our leaf ----
  const DEW = mobile ? 60 : 130;
  const dew = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 14, 10),
    new THREE.MeshPhysicalMaterial({ color: 0xeaffea, roughness: 0, metalness: 0, transparent: true, opacity: 0.2, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 4.5, depthWrite: false }),
    DEW,
  );
  let n = 0;
  for (let i = 0, tries = 0; n < DEW && tries < 4000; i++, tries++) {
    const x = (rand(i) - 0.5) * LEAF_W * 0.88, z = (rand(i + 500) - 0.5) * LEAF_D * 0.86;
    const inLeaf = (x / (LEAF_W * 0.45)) ** 2 + (z / (LEAF_D * 0.43)) ** 2 < 1;
    const underDish = protos.some((d) => Math.hypot(x - d.x, z - d.z) < d.w * 0.55);
    if (!inLeaf || underDish) continue;
    const r = 0.01 + rand(i + 900) ** 2 * 0.032;
    dew.setMatrixAt(n++, m4.compose(v3.set(x, leafHeight(x, z) + r * 0.3, z), q, s3.set(r, r * 0.55, r)));
  }
  dew.count = n;
  dew.renderOrder = 2;
  hall.add(dew);

  // ---- Petals and leaves drifting down ----
  const FALL = mobile ? 9 : 16;
  const fallers = [];
  const fallKinds = ['jasmine', 'curryleaf', 'marigold', 'curryleaf', 'jasmine', 'chilli'];
  for (let i = 0; i < FALL; i++) {
    const id = fallKinds[i % fallKinds.length];
    const size = id === 'marigold' ? 0.55 : id === 'jasmine' ? 0.42 : 0.7;
    const { cut } = garnish[id];
    const f = frame(cut.img);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size * f.sx, size * f.aspect * f.sy),
      new THREE.MeshStandardMaterial({ map: cut.tex, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 0.6, envMapIntensity: 0.3 }),
    );
    m.castShadow = true;
    m.userData = { x: (rand(i + 11) - 0.5) * 15, z: (rand(i + 23) - 0.5) * 8, seed: rand(i + 31), speed: 0.7 + rand(i + 5) * 0.6 };
    scene.add(m);
    fallers.push(m);
  }

  // ---- Gold dust in the light ----
  const DUST = mobile ? 70 : 160;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) dustPos.set([(rand(i + 3) - 0.5) * 20, 0.6 + rand(i + 60) * 8, (rand(i + 90) - 0.5) * 11], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: softDot(64, [[0, 'rgba(255,225,150,1)'], [0.35, 'rgba(255,200,110,0.5)'], [1, 'rgba(255,190,90,0)']]),
    size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  scene.add(dust);

  // ---- Camera rig ----
  // t 0→3 walks the four chapters: 0 the lamp in the dark, 1 the lamplit leaf, 2 the hall, 3 the hall from higher up.
  // light: key light sweep.  fall: petal drift.
  const state = { t: 0, light: 0, fall: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let portrait = false;
  let fit = 20;

  function resize() {
    const wpx = container.clientWidth, hpx = container.clientHeight;
    renderer.setSize(wpx, hpx, false);
    camera.aspect = wpx / hpx;
    camera.updateProjectionMatrix();
    portrait = hpx > wpx;
    const t = Math.tan((30 / 2) * DEG);
    fit = portrait
      ? Math.max((LEAF_W * 1.1) / 2 / t, (LEAF_D * 1.36) / 2 / (t * camera.aspect))
      : Math.max((LEAF_W * 1.2) / 2 / (t * camera.aspect), (LEAF_D * 1.75) / 2 / t);
  }
  resize();
  window.addEventListener('resize', resize);
  if (window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('pointermove', (e) => {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  // Upload every texture and compile every material now, so the first frames don't stutter
  scene.traverse((o) => {
    const m = o.material;
    if (m) for (const key of ['map', 'normalMap', 'roughnessMap', 'clearcoatNormalMap']) if (m[key]) renderer.initTexture(m[key]);
  });
  renderer.compile(scene, camera);

  // Chapter keyframes: where the camera stands, what it looks at, which way is up, lens, lights, fog.
  const K = (pos, at, up, fov, pool, lamp, fogFar) => ({ pos: new THREE.Vector3(...pos), at: new THREE.Vector3(...at), up: new THREE.Vector3(...up).normalize(), fov, pool, lamp, fogFar });
  function keys() {
    const T = import.meta.env.DEV ? window.__tune || {} : {}; // dev-only camera tuning from the console
    const L = LAMP_AT;
    if (portrait) {
      const phi = (T.pphi ?? 38) * DEG, d = fit * (T.pd ?? 1.28), ax = T.ptx ?? 2.6;
      return [
        K([L.x + 2.6, 2.4, L.z + 10], [L.x + 1.6, 2.0, L.z], [0, 1, 0], 36, 0, 1, 60),
        K([ax - d * Math.sin(phi), d * Math.cos(phi), 0], [ax, 0, 0], [1, 0, 0], 30, 1, 1, 110),
        K([-9, 20, 0.4], [26, 0, 0], [1, 0, 0], 48, 1, 0.6, 220),
        K([-11, 24, 0.4], [28, 0, 0], [1, 0, 0], 50, 0.55, 0.6, 220),
      ];
    }
    const phi = (T.phi ?? 46) * DEG, d = fit * (T.d ?? 1.32), az = T.tz ?? -3;
    return [
      K([L.x + 5.6, 2.4, L.z + 9.5], [L.x + 3.6, 1.8, L.z], [0, 1, 0], 32, 0, 1, 60),
      K([0, d * Math.cos(phi), az + d * Math.sin(phi)], [0, 0, az], [0, 0, -1], 30, 1, 1, 110),
      K([-7, 15, 17], [24, 0, -7], [0, 0, -1], 30, 1, 0.6, 220),
      K([-9, 19, 20], [26, 0, -9], [0, 0, -1], 30, 0.55, 0.6, 220),
    ];
  }

  const target = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const up = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  function render(time) {
    const sec = time * 0.001;
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;

    // Between two chapters: ease from one keyframe to the next
    const ks = keys();
    const t = clamp(state.t, 0, ks.length - 1);
    const i = Math.min(ks.length - 2, Math.floor(t));
    const f = smoothstep(t - i, 0, 1);
    const a = ks[i], b = ks[i + 1];
    camPos.lerpVectors(a.pos, b.pos, f);
    target.lerpVectors(a.at, b.at, f);
    up.lerpVectors(a.up, b.up, f).normalize();
    const fov = lerp(a.fov, b.fov, f);
    pool.intensity = lerp(a.pool, b.pool, f) * 150;
    fog.far = lerp(a.fogFar, b.fogFar, f);
    fog.near = lerp(14, 40, Math.min(1, t / 2));
    // A slow breath and a little parallax from the pointer, so the frame is never dead still
    camPos.x += pointer.sx * 0.5 + Math.sin(sec * 0.22) * 0.08;
    camPos.y += pointer.sy * 0.3 + Math.sin(sec * 0.35) * 0.05;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.up.copy(up);
    camera.position.copy(camPos);
    camera.lookAt(target);

    // Key light travels from the left to the right as you scroll
    const az = lerp(-0.75, 0.6, state.light) + pointer.sx * 0.3;
    sun.position.set(Math.sin(az) * 10, 7.5, Math.cos(az) * 9); // low enough for long, soft shadows

    // The lamp faces the camera; its flame breathes
    toCam.subVectors(camera.position, lamp.position);
    lamp.rotation.y = Math.atan2(toCam.x, toCam.z);
    const flicker = 1 + 0.08 * Math.sin(sec * 9.1) + 0.05 * Math.sin(sec * 23.7) + 0.04 * Math.sin(sec * 3.3);
    const lampOn = lerp(a.lamp, b.lamp, f);
    flame.scale.setScalar(0.62 * flicker);
    flame.material.opacity = lampOn;
    lampLight.intensity = 30 * flicker * lampOn;
    flames.material.opacity = 0.9 + 0.1 * Math.sin(sec * 7);

    for (const s of steam) {
      const ph = (time * 0.00028 + s.userData.phase) % 1;
      s.position.set(Math.sin(ph * 6 + s.userData.phase * 9) * 0.06, s.userData.top + 0.25 + ph * 1.3, 0);
      s.scale.setScalar(s.userData.w * (0.25 + ph * 0.6));
      s.material.opacity = Math.sin(ph * Math.PI) * 0.13 * smoothstep(t, 0.4, 1) * (1 - smoothstep(t, 1.4, 2));
    }

    // Petals tumble down past the camera and wrap around
    const petals = smoothstep(t, 0.6, 1.1) * (1 - smoothstep(t, 1.5, 2));
    fallers.forEach((m) => {
      const u = m.userData;
      // Kept well below the camera: a petal right in front of the lens is just a blur.
      const y = 5.4 - ((u.seed * 6 + state.fall * 7 * u.speed + sec * 0.1 * u.speed) % 6);
      m.position.set(u.x + Math.sin(sec * 0.5 + u.seed * 20) * 0.35, y, u.z + Math.cos(sec * 0.4 + u.seed * 9) * 0.25);
      m.rotation.set(sec * 0.5 * u.speed + u.seed * 6, sec * 0.35 + u.seed * 3, state.fall * 6 * u.speed + u.seed * 4);
      m.scale.setScalar(smoothstep(5.4 - y, 0, 0.7));
      m.visible = y > 0.15 && petals > 0.05;
    });

    dust.position.y = Math.sin(sec * 0.3) * 0.25;
    dust.rotation.y = sec * 0.02;
    dust.material.opacity = 0.6 * smoothstep(t, 0.3, 1);

    renderer.render(scene, camera);
  }

  let visible = true;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(container);
  const loop = (time) => { if (visible) render(time); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  if (import.meta.env.DEV) window.__feast3d = { scene, camera, state, hall, renderer, pool, lampLight };
  return { state, canvas };
}
