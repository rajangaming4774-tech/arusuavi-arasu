import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Real 3D Chettinad pillars (thoon) for the "Notable celebrations" hall. The wall itself is CSS 3D;
// this draws the pillars on a WebGL layer over it with a camera that matches the stage's CSS
// perspective, and every frame copies the wall's live CSS transform so the pillars stay locked to it.
// Each pillar: a stepped granite plinth, a turned Burma-teak shaft with brass bands, a lotus-pot neck,
// a square abacus and a carved potikai bracket with hanging lotus buds. The pillars cast soft
// courtyard-light shadows onto the wall and floor. The .pillar elements stay in the layout as
// placeholders (and as the photo cut-out fallback when WebGL is unavailable).
export default function pillars3d(section, track) {
  const stage = track.parentElement;
  const slots = [...track.querySelectorAll('.pillar')];
  if (!slots.length) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return; // no WebGL: the photo cut-outs stay
  }
  const canvas = renderer.domElement;
  canvas.className = 'wall-3d';
  canvas.setAttribute('aria-hidden', 'true');
  stage.insertBefore(canvas, track.nextSibling);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 20000);

  // Everything lives in "hall": its matrix is the wall's CSS transform (with y flipped to Three's y-up)
  const hall = new THREE.Group();
  hall.matrixAutoUpdate = false;
  scene.add(hall);

  // ---------- materials ----------
  const teak = new THREE.MeshPhysicalMaterial({
    map: woodTexture(), color: 0xc9a493, roughness: 0.45, clearcoat: 0.75, clearcoatRoughness: 0.25,
  });
  const teakCarved = teak.clone();
  teakCarved.color = new THREE.Color(0xa47e6c); // carved parts sit a touch darker
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4a548, metalness: 1, roughness: 0.32 });
  const granite = new THREE.MeshStandardMaterial({ map: graniteTexture(), roughness: 0.38, metalness: 0.05 });

  // ---------- one pillar, built for a given height (y up, origin at the foot) ----------
  function buildPillar(H) {
    const g = new THREE.Group();
    const D = H * 0.07; // shaft diameter
    const R = D / 2;
    const add = (geo, mat, y = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = true;
      g.add(m);
      return m;
    };

    // Stepped granite plinth
    const steps = [[2.7, 0.034], [2.25, 0.03], [1.85, 0.026]];
    let y = 0;
    for (const [w, h] of steps) {
      add(new RoundedBoxGeometry(D * w, H * h, D * w, 3, Math.min(D * 0.06, H * h * 0.3)), granite, y + (H * h) / 2);
      y += H * h;
    }

    // Turned shaft: a base moulding, a gentle taper, and a neck under the capital
    const capH = H * 0.2;
    const top = H - capH;
    const L = top - y;
    const prof = [
      [0, 0], [R * 1.42, 0], [R * 1.42, L * 0.012], [R * 1.3, L * 0.022], [R * 1.34, L * 0.035],
      [R * 1.12, L * 0.05], [R * 1.02, L * 0.065], [R, L * 0.08],
      [R * 0.9, L * 0.92], [R * 0.98, L * 0.94], [R * 0.98, L * 0.96], [R * 0.86, L * 0.975], [R * 0.86, L], [0, L],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    add(new THREE.LatheGeometry(prof, 48), teak, y);

    // Brass bands near the foot and the head of the shaft
    const band = (at, r) => add(new THREE.CylinderGeometry(r, r, H * 0.012, 48, 1, true), brass, y + L * at);
    band(0.15, R * 0.995);
    band(0.82, R * 0.925);
    add(new THREE.TorusGeometry(R * 1.36, R * 0.07, 10, 48).rotateX(Math.PI / 2), brass, y + L * 0.036);

    // Capital: lotus pot (kalasam) neck, square abacus, then the carved bracket
    const pot = [
      [0, 0], [R * 0.86, 0], [R * 1.25, capH * 0.08], [R * 1.4, capH * 0.18], [R * 1.25, capH * 0.28],
      [R * 0.95, capH * 0.33], [R * 1.12, capH * 0.37], [R * 1.12, capH * 0.4], [0, capH * 0.4],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    add(new THREE.LatheGeometry(pot, 48), teakCarved, top);
    // petals carved into the pot
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const petal = add(new THREE.SphereGeometry(R * 0.32, 12, 8).scale(0.55, 1.5, 0.35), teakCarved, top + capH * 0.16);
      petal.position.x = Math.cos(a) * R * 1.3;
      petal.position.z = Math.sin(a) * R * 1.3;
      petal.rotation.y = -a + Math.PI / 2;
    }
    add(new RoundedBoxGeometry(D * 1.75, capH * 0.12, D * 1.75, 3, D * 0.05), teak, top + capH * 0.46);
    add(new THREE.BoxGeometry(D * 1.9, capH * 0.02, D * 1.9), brass, top + capH * 0.53);

    // Potikai: a carved bracket spreading along the wall, with scrolls and hanging lotus buds
    const span = D * 1.75; // half-width of the bracket
    const bh = capH * 0.46; // bracket height
    const s = new THREE.Shape();
    s.moveTo(-R * 0.9, 0);
    s.lineTo(R * 0.9, 0);
    s.bezierCurveTo(R * 1.6, bh * 0.05, span * 0.75, bh * 0.25, span * 0.86, bh * 0.42);
    s.bezierCurveTo(span * 1.02, bh * 0.38, span * 1.06, bh * 0.58, span * 0.98, bh * 0.66);
    s.lineTo(span, bh);
    s.lineTo(-span, bh);
    s.lineTo(-span * 0.98, bh * 0.66);
    s.bezierCurveTo(-span * 1.06, bh * 0.58, -span * 1.02, bh * 0.38, -span * 0.86, bh * 0.42);
    s.bezierCurveTo(-span * 0.75, bh * 0.25, -R * 1.6, bh * 0.05, -R * 0.9, 0);
    const depth = D * 1.15;
    const bracket = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: D * 0.05, bevelSize: D * 0.04, bevelSegments: 3, curveSegments: 24 });
    bracket.translate(0, 0, -depth / 2);
    add(bracket, teakCarved, top + capH * 0.54);
    // a brass strip along the bracket's top edge, and a carved bead row on its face
    add(new THREE.BoxGeometry(span * 2.04, capH * 0.025, depth * 1.12), brass, top + capH * 0.54 + bh);
    for (let i = -4; i <= 4; i++) {
      const bead = add(new THREE.SphereGeometry(D * 0.07, 10, 8), teakCarved, top + capH * 0.54 + bh * 0.82);
      bead.position.x = (i / 4) * span * 0.8;
      bead.position.z = depth / 2 + D * 0.05;
    }
    // hanging lotus buds under the scrolls
    for (const side of [-1, 1]) {
      const bud = new THREE.Group();
      const b = new THREE.Mesh(new THREE.SphereGeometry(D * 0.2, 16, 12).scale(1, 1.3, 1), teakCarved);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(D * 0.11, D * 0.22, 16).rotateX(Math.PI), teakCarved);
      tip.position.y = -D * 0.32;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(D * 0.15, D * 0.035, 8, 24).rotateX(Math.PI / 2), brass);
      collar.position.y = D * 0.2;
      for (const m of [b, tip, collar]) { m.castShadow = true; bud.add(m); }
      bud.position.set(side * span * 0.9, top + capH * 0.54 + bh * 0.3, 0);
      g.add(bud);
    }
    return g;
  }

  // ---------- shadow catchers: the plaster wall and the tiled floor ----------
  const catcher = new THREE.ShadowMaterial({ color: 0x2a1405, opacity: 0.24 });
  const wallPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), catcher);
  wallPlane.receiveShadow = true;
  hall.add(wallPlane);
  const floorPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), catcher.clone());
  floorPlane.material.opacity = 0.34;
  floorPlane.rotation.x = -Math.PI / 2;
  floorPlane.receiveShadow = true;
  hall.add(floorPlane);

  // ---------- light: soft daylight from the courtyard, front-left and above ----------
  hall.add(new THREE.HemisphereLight(0xfff1dc, 0x4a2a14, 0.9));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  sun.shadow.radius = 6;
  hall.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.5);
  hall.add(fill, fill.target);

  // ---------- layout: build pillars where the .pillar placeholders sit ----------
  let built = [];
  function layout() {
    built.forEach((p) => { hall.remove(p); p.traverse((o) => o.geometry?.dispose()); });
    built = slots.map((el) => {
      const H = el.offsetHeight;
      const p = buildPillar(H);
      // CSS wall-local: x right, y down, z out. In hall space y is flipped.
      p.position.set(el.offsetLeft + el.offsetWidth / 2, -(el.offsetTop + H), 70);
      hall.add(p);
      return p;
    });
    const first = slots[0], last = slots[slots.length - 1];
    const x0 = first.offsetLeft - 1500, x1 = last.offsetLeft + 1500;
    const foot = last.offsetTop + last.offsetHeight;
    wallPlane.scale.set(x1 - x0, foot + 400, 1);
    wallPlane.position.set((x0 + x1) / 2, -(foot - 400) / 2, 0);
    floorPlane.scale.set(x1 - x0, 1400, 1);
    floorPlane.position.set((x0 + x1) / 2, -foot, 700);

    const mid = (x0 + x1) / 2;
    sun.position.set(mid - 900, 1400, 1700);
    sun.target.position.set(mid, -foot / 2, 0);
    fill.position.set(mid + 1200, 300, 1500);
    fill.target.position.set(mid, -foot / 2, 0);
    const c = sun.shadow.camera;
    const half = (x1 - x0) / 2 + 600;
    Object.assign(c, { left: -half, right: half, top: 1800, bottom: -1800, near: 100, far: 6000 });
    c.updateProjectionMatrix();
    const small = window.innerWidth < 700;
    sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 1024 : 2048);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }

  // ---------- camera: match the stage's CSS perspective and perspective-origin ----------
  let W = 0, Hs = 0;
  function sizeCamera() {
    W = stage.clientWidth;
    Hs = stage.clientHeight;
    renderer.setSize(W, Hs, false);
    const cs = getComputedStyle(stage);
    const P = parseFloat(cs.perspective) || 1300;
    const [ox, oy] = cs.perspectiveOrigin.split(' ').map(parseFloat);
    // A symmetric frustum centred on the eye, wide enough to contain the stage; then crop to it
    const fw = 2 * Math.max(ox, W - ox);
    const fh = 2 * Math.max(oy, Hs - oy);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(fh / 2 / P));
    camera.aspect = fw / fh;
    camera.position.set(ox, -oy, P);
    camera.lookAt(ox, -oy, 0);
    camera.setViewOffset(fw, fh, fw / 2 - ox, fh / 2 - oy, W, Hs);
    camera.updateProjectionMatrix();
  }

  // ---------- per frame: copy the wall's CSS transform onto the hall ----------
  const F = new THREE.Matrix4().makeScale(1, -1, 1);
  const css = new THREE.Matrix4();
  const tmp = new THREE.Matrix4();
  function sync() {
    const tf = getComputedStyle(track).transform;
    const m = tf && tf !== 'none' ? new DOMMatrix(tf) : new DOMMatrix();
    css.fromArray(m.toFloat64Array());
    const oy = track.offsetHeight / 2; // transform-origin: 0% 50%
    // stage = T(left, top) · T(0, oy) · M · T(0, -oy) · wallLocal ; hall = F · stage · F
    tmp.makeTranslation(track.offsetLeft, track.offsetTop + oy, 0).multiply(css).multiply(new THREE.Matrix4().makeTranslation(0, -oy, 0));
    hall.matrix.copy(F).multiply(tmp).multiply(F);
    hall.matrixWorldNeedsUpdate = true;
  }

  let visible = false;
  let dirty = true;
  function frame() {
    if (!visible) return;
    if (dirty) { sizeCamera(); layout(); dirty = false; }
    sync();
    renderer.render(scene, camera);
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '200px' }).observe(stage);
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { dirty = true; }, 150); });
  section.classList.add('has-3d');
  return frame; // the caller ticks it after the wall moves
}

// Polished Burma teak: a photographed grain (public/images/chettinad/teak.webp, from scripts/chettinad.mjs)
// running along the shaft
function woodTexture() {
  const t = new THREE.TextureLoader().load('/images/chettinad/teak.webp');
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.anisotropy = 8;
  return t;
}

// Black granite: near-black with grey and faint mica speckles
function graniteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1b1816';
  x.fillRect(0, 0, 256, 256);
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const v = rnd();
    x.fillStyle = v < 0.7 ? `rgba(70, 64, 60, ${rnd() * 0.6})` : v < 0.95 ? `rgba(10, 8, 7, 0.8)` : `rgba(220, 210, 190, ${rnd() * 0.5})`;
    x.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
