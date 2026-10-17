import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MENU, HOT } from './feast-menu.js';

/*
 * Home hero: "the royal table".
 * A dark wedding hall lit by brass lamps. One slow camera move in four chapters:
 * the lamp and the family name, the lamplit banana-leaf meal, the hall of leaves
 * stretching away, and the words of the families we have served. Each chapter's
 * text fades in and out as the scroll moves the camera on.
 */

const SPICES = [
  // red chilli
  '<svg viewBox="0 0 60 120"><path d="M30 18c14 4 20 22 16 48-4 24-14 44-22 50-4 3-6-1-4-6 6-16 6-40 2-60-2-12 0-30 8-32Z" fill="#7d0a10"/><path d="M27 20c-2-8 2-14 8-16 2 4 0 10-4 14Z" fill="#2f6b3a"/><path d="M36 30c4 10 4 26 0 40" stroke="#e8453a" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
  // curry leaf
  '<svg viewBox="0 0 60 120"><path d="M30 6C52 30 54 80 30 114 6 80 8 30 30 6Z" fill="#3f8a3c"/><path d="M30 10v100M30 40l12-10M30 60l14-10M30 80l12-9M30 40 18 30M30 60 16 50M30 80 18 71" stroke="#2a5e2a" stroke-width="2" fill="none"/></svg>',
  // star anise
  '<svg viewBox="0 0 100 100"><g fill="#8a4a24" stroke="#5a2c12" stroke-width="2"><path id="s" d="M50 50 44 12c2-6 10-6 12 0Z"/><use href="#s" transform="rotate(45 50 50)"/><use href="#s" transform="rotate(90 50 50)"/><use href="#s" transform="rotate(135 50 50)"/><use href="#s" transform="rotate(180 50 50)"/><use href="#s" transform="rotate(225 50 50)"/><use href="#s" transform="rotate(270 50 50)"/><use href="#s" transform="rotate(315 50 50)"/></g><circle cx="50" cy="50" r="7" fill="#f2a93b"/></svg>',
  // cardamom
  '<svg viewBox="0 0 60 100"><path d="M30 8c16 10 20 50 0 84C10 58 14 18 30 8Z" fill="#9ab86a"/><path d="M30 14c4 20 4 50 0 74M22 30c2 16 2 34 4 50M38 30c-2 16-2 34-4 50" stroke="#6f8f45" stroke-width="2" fill="none"/></svg>',
];

function addSpices(container, count) {
  return Array.from({ length: count }, (_, i) => {
    const el = document.createElement('figure');
    el.className = 'hero__spice';
    el.innerHTML = SPICES[i % SPICES.length].replaceAll('"s"', `"s${i}"`).replaceAll('#s"', `#s${i}"`);
    const depth = 0.5 + ((i * 37) % 100) / 100; // 0.5–1.5: bigger = closer = faster
    el.style.width = Math.round(30 * depth + 14) + 'px';
    el.style.left = ((i * 61) % 96) + 2 + '%';
    el.style.top = ((i * 43) % 90) + 5 + '%';
    el.style.zIndex = depth > 1.2 ? 3 : 1;
    if (depth < 0.8) el.style.filter = 'blur(1.5px) drop-shadow(0 8px 10px rgba(58,10,12,.4))';
    container.appendChild(el);
    return { el, depth, spin: (i % 2 ? 1 : -1) * (120 + (i % 5) * 50) };
  });
}

// Photo fallback (no WebGL, or reduced motion): one cut-out image per dish, already on the leaf
function buildPhotoDishes(table) {
  return MENU.map((d) => {
    const img = document.createElement('img');
    img.className = 'feast__dish';
    img.src = `/feast/${d.id}.webp`;
    img.alt = '';
    img.style.cssText = `--x:${d.x};--y:${d.y};--w:${d.w}`;
    table.appendChild(img);
    if (HOT.has(d.id)) {
      const steam = Object.assign(document.createElement('span'), { className: 'steam', innerHTML: '<i></i><i></i><i></i>' });
      steam.setAttribute('style', img.getAttribute('style'));
      table.appendChild(steam);
    }
    return img;
  });
}

async function try3D(section) {
  const probe = document.createElement('canvas');
  if (!probe.getContext('webgl2')) return null;
  try {
    const { createFeast3D } = await import('./feast3d.js');
    return await createFeast3D(section.querySelector('[data-feast]'));
  } catch (err) {
    console.warn('3D feast unavailable, using photos', err);
    return null;
  }
}

export default async function hero(section, { reduceMotion }) {
  const table = section.querySelector('[data-feast-table]');
  const chapters = [...section.querySelectorAll('[data-chapter]')];
  const cue = section.querySelector('[data-hero-cue]');

  if (reduceMotion) { buildPhotoDishes(table); return; }

  const portrait = () => window.innerHeight > window.innerWidth;

  // Real 3D hall where the device supports it; otherwise the photo version.
  const feast3d = await try3D(section);
  if (feast3d) table.hidden = true;
  else buildPhotoDishes(table);
  // The 3D scene has its own real petals and spices; the drawn ones are for the photo version.
  const spices = feast3d ? [] : addSpices(section.querySelector('[data-hero-spices]'), window.innerWidth < 700 ? 12 : 20);

  // Settle in on load
  gsap.from(section.querySelector('[data-feast]'), { autoAlpha: 0, duration: 2.4, ease: 'power2.out' });
  gsap.set(chapters[0], { autoAlpha: 1 });
  gsap.from(chapters[0].firstElementChild.children, { y: 30, autoAlpha: 0, duration: 1.6, ease: 'expo.out', stagger: 0.18, delay: 0.5 });

  let tl;
  function build() {
    tl?.scrollTrigger?.kill();
    tl?.kill();
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true },
    });

    // The timeline runs 0→3, one unit per chapter change
    const CH = 3;
    tl.to(cue, { autoAlpha: 0, duration: 0.08 }, 0.04);
    // Chapter texts: the first is up on load; each next one rises in and drifts out
    tl.to(chapters[0], { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, 0.2);
    const show = (el, from, to) => {
      tl.fromTo(el, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power2.out' }, from);
      if (to) tl.to(el, { autoAlpha: 0, y: -36, duration: 0.26, ease: 'power2.in' }, to - 0.26);
    };
    show(chapters[1], 0.8, 1.75);
    show(chapters[2], 1.85, 2.6);
    show(chapters[3], 2.68);

    if (feast3d) {
      const s = feast3d.state;
      // The camera moves on with the scroll; the key light sweeps across; petals drift
      tl.fromTo(s, { t: 0 }, { t: CH, duration: CH }, 0)
        .fromTo(s, { light: 0 }, { light: 1, duration: CH }, 0)
        .fromTo(s, { fall: 0 }, { fall: 1, duration: CH }, 0);
    } else {
      // Photo version: the flat leaf comes up out of the dark, then tilts back and shrinks away
      const flat = portrait() ? { rotateZ: 90 } : { rotateZ: 0 };
      gsap.set(table, { ...flat, rotateX: 0, scale: 0.9, y: '14vh', autoAlpha: 0.15 });
      tl.to(table, { scale: 1, y: '6vh', autoAlpha: 1, duration: 0.8, ease: 'power2.out' }, 0.2)
        .to(table, { rotateX: 58, scale: portrait() ? 0.55 : 0.66, y: portrait() ? '-8vh' : '-12vh', duration: 0.9, ease: 'power2.inOut' }, 1.6);
    }
    tl.to({}, { duration: 0.3 });

    // Spices fall past at speeds set by their depth
    spices.forEach(({ el, depth, spin }) => {
      tl.fromTo(el, { y: `${30 * depth}vh`, rotation: 0 }, { y: `${-90 * depth}vh`, rotation: spin, duration: 3 }, 0);
    });
  }

  build();
  ScrollTrigger.refresh();
  let wasPortrait = portrait();
  window.addEventListener('resize', () => {
    if (portrait() !== wasPortrait) { wasPortrait = portrait(); build(); }
  });
}
