import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/*
 * A night gallery: event photos hang on the inside of a cylinder around the camera, each in a
 * gilt frame with an ivory mount, reflected in a polished floor, with faint gold dust drifting
 * in the lamplight. Scrolling turns the cylinder; the photo in front comes into full colour,
 * and scroll speed bends the planes.
 * Falls back to a swipeable strip when WebGL or motion is unavailable.
 */
export default async function spotlight(section, { reduceMotion }) {
  const canvas = section.querySelector('[data-spotlight-canvas]');
  const strip = section.querySelector('[data-spotlight-strip]');
  const caption = section.querySelector('[data-spotlight-caption]');
  const count = section.querySelector('[data-spotlight-count]');
  const fallback = () => { section.classList.add('is-fallback'); canvas.remove(); ScrollTrigger.refresh(); };
  if (reduceMotion || !canvas.getContext('webgl2')) return fallback();

  const THREE = await import('three');
  const imgs = [...strip.querySelectorAll('img')];
  const small = window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const group = new THREE.Group();
  group.position.y = -0.3;
  scene.add(group);

  // Frame sizes in world units: gilt moulding, ivory mount, gold fillet around the photo
  const R = 9, W = 2.84, H = 3.55, GAP = 0.62;
  const GILT = 0.11, MOUNT = 0.13, FILLET = 0.014;
  const step = (W + GAP) / R;
  const geometry = new THREE.PlaneGeometry(W, H, 32, 1);
  const loader = new THREE.TextureLoader();

  const vertexShader = /* glsl */ `
    uniform float uVelocity;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 p = position;
      p.z += sin(uv.x * 3.14159) * uVelocity;
      p.y *= 1.0 + abs(uVelocity) * 0.05 * sin(uv.x * 3.14159);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const fragmentShader = /* glsl */ `
    uniform sampler2D uTex;
    uniform vec2 uCover;
    uniform vec2 uSize;
    uniform float uFocus;
    uniform float uReflect;
    uniform float uReady;
    varying vec2 vUv;

    // Burnished gold with a soft running sheen
    vec3 gilt(vec2 p, float shade) {
      float s = 0.5 + 0.5 * sin((p.x * 0.7 + p.y * 0.45) * 14.0 + 1.3);
      vec3 g = mix(vec3(0.45, 0.28, 0.05), vec3(1.0, 0.82, 0.42), s * 0.75 + 0.15);
      return g * shade;
    }

    void main() {
      vec2 pos = vUv * uSize;                       // position on the frame in world units
      vec2 d2 = min(pos, uSize - pos);
      float e = min(d2.x, d2.y);                    // distance in from the outer edge
      float aa = fwidth(e) * 1.2;
      float G = ${GILT.toFixed(3)}, M = ${MOUNT.toFixed(3)}, F = ${FILLET.toFixed(3)};

      // Gilt moulding: rounded profile catches the light along its crown, lit from above
      float k = clamp(e / G, 0.0, 1.0);
      float crown = 0.62 + 0.55 * sin(k * 3.14159) - 0.18 * k;
      vec3 goldCol = gilt(vUv * uSize, crown * mix(0.82, 1.12, vUv.y));

      // Ivory mount, shaded where the frame's lip overhangs it
      float lip = smoothstep(G, G + 0.05, e);
      vec3 mountCol = vec3(0.94, 0.9, 0.82) * mix(0.72, 1.0, lip);

      // Photo, cover-fitted into the opening
      vec2 inner = (pos - vec2(G + M)) / (uSize - 2.0 * (G + M));
      vec2 uv = (inner - 0.5) * uCover + 0.5;
      vec3 photo = texture2D(uTex, uv).rgb * uReady + vec3(0.08, 0.05, 0.04) * (1.0 - uReady);
      vec2 dv = inner - 0.5;
      photo *= 1.0 - dot(dv, dv) * 0.35;

      vec3 col = mix(goldCol, mountCol, smoothstep(G - aa, G + aa, e));
      col = mix(col, photo, smoothstep(G + M - aa, G + M + aa, e));
      // Thin gold fillet hugging the photo
      float fil = 1.0 - smoothstep(F * 0.5 - aa, F * 0.5 + aa, abs(e - (G + M - F * 0.5)));
      col = mix(col, gilt(vUv * uSize, 1.0), fil);

      // Frames away from the light fall into warm shadow
      float g = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 dim = mix(vec3(g), col, 0.55) * vec3(0.46, 0.38, 0.32);
      col = mix(dim, col, uFocus);

      float alpha = 1.0;
      if (uReflect > 0.5) {
        // Polished floor: a faint, darkening mirror image that fades with distance
        alpha = pow(1.0 - vUv.y, 3.0) * 0.26;
        col *= 0.7;
      }
      gl_FragColor = vec4(col, alpha);
      #include <colorspace_fragment>
    }`;

  const meshes = imgs.map((img, i) => {
    const theta = i * step;
    const uniforms = {
      uTex: { value: null }, uCover: { value: new THREE.Vector2(1, 1) }, uSize: { value: new THREE.Vector2(W, H) },
      uFocus: { value: 0 }, uVelocity: { value: 0 }, uReflect: { value: 0 }, uReady: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(R * Math.sin(theta), 0, -R * Math.cos(theta));
    mesh.rotation.y = -theta;
    mesh.userData = { theta, alt: img.alt };
    group.add(mesh);

    // Its reflection shares every uniform except the mirror flag
    const reflection = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uReflect: { value: 1 } }, vertexShader, fragmentShader,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    reflection.scale.y = -1;
    reflection.position.y = -H - 0.06;
    mesh.add(reflection);

    // Phones get the 1200 px copy; larger screens the 4K-class texture
    const url = (!small && img.dataset.tex) || img.getAttribute('src');
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = anisotropy;
      const ia = tex.image.width / tex.image.height;
      const pa = (W - 2 * (GILT + MOUNT)) / (H - 2 * (GILT + MOUNT));
      uniforms.uCover.value.set(ia > pa ? pa / ia : 1, ia > pa ? 1 : ia / pa);
      uniforms.uTex.value = tex;
      uniforms.uReady.value = 1;
      needsRender = true;
    });
    return mesh;
  });

  // Gold dust drifting through the lamplight
  const DUST = small ? 90 : 220;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos.set([(Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, -2 - Math.random() * 6.5], i * 3);
    dustSeed[i] = Math.random() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: renderer.getPixelRatio() } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScale;
      attribute float aSeed;
      varying float vTwinkle;
      void main() {
        vec3 p = position;
        p.y += mod(uTime * 0.05 + aSeed, 6.0) - 3.0;
        p.x += sin(uTime * 0.2 + aSeed) * 0.25;
        vTwinkle = 0.45 + 0.55 * sin(uTime * 1.1 + aSeed * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + fract(aSeed) * 3.0) * uScale * (6.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * 0.75 * vTwinkle;
        gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * a, a);
      }`,
  });
  scene.add(new THREE.Points(dustGeo, dustMat));

  const last = (imgs.length - 1) * step;
  const state = { target: 0, current: 0, velocity: 0 };
  let needsRender = true;
  let visible = false;
  let lastIdx = -1;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Sit back a little so the floor reflections show beneath the frames
    // On wide screens the frames sit lower, clear of the heading
    const narrow = camera.aspect < 0.9;
    camera.position.set(0, 0.35, narrow ? 5.4 : 1.3);
    camera.lookAt(0, -0.55, -R);
    group.position.y = narrow ? -0.3 : -0.95;
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  resize();
  window.addEventListener('resize', resize);

  ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom',
    onUpdate: ({ progress }) => (state.target = progress * last),
  });
  // Only spend GPU time while the section is on screen.
  ScrollTrigger.create({ trigger: section, start: 'top bottom', end: 'bottom top', onToggle: ({ isActive }) => (visible = isActive) });

  gsap.ticker.add((time) => {
    if (!visible && !needsRender) return;
    const prev = state.current;
    state.current += (state.target - state.current) * 0.08;
    const delta = state.current - prev;
    state.velocity += (gsap.utils.clamp(-0.8, 0.8, delta * 18) - state.velocity) * 0.15;
    group.rotation.y = state.current;
    dustMat.uniforms.uTime.value = time;
    let focusIdx = 0, best = 0;
    meshes.forEach((m, i) => {
      const f = gsap.utils.clamp(0, 1, 1 - Math.abs(m.userData.theta - state.current) / step);
      m.material.uniforms.uFocus.value = f;
      m.material.uniforms.uVelocity.value = state.velocity;
      if (f > best) { best = f; focusIdx = i; }
    });
    if (focusIdx !== lastIdx) {
      caption.textContent = meshes[focusIdx].userData.alt;
      if (count) count.textContent = `${String(focusIdx + 1).padStart(2, '0')} / ${String(meshes.length).padStart(2, '0')}`;
      lastIdx = focusIdx;
    }
    renderer.render(scene, camera);
    needsRender = false;
  });
}
