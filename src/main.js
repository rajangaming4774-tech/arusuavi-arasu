import './styles/main.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) document.documentElement.classList.add('reduced-motion');

/* ---------- Smooth scroll, synced with ScrollTrigger ---------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
export { lenis };

/* ---------- Header: always on screen (the logo never hides), solid after the hero ---------- */
const header = document.querySelector('[data-header]');
// On home the header stays transparent over the video hero, and turns solid as soon as the
// manifesto (which slides up over the pinned hero) reaches it, so it never sits clear over cream.
const homeHero = document.querySelector('[data-vhero]');
const solidFrom = () => {
  if (!homeHero) return 80;
  const next = homeHero.nextElementSibling;
  return (next ? next.getBoundingClientRect().top + window.scrollY : homeHero.offsetTop + homeHero.offsetHeight) - 80;
};
function onScroll() {
  header.classList.toggle('is-solid', window.scrollY > solidFrom());
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Mobile menu ---------- */
const toggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-mobile-menu]');
function setMenu(open) {
  toggle.setAttribute('aria-expanded', String(open));
  menu.hidden = !open;
  document.body.classList.toggle('menu-open', open);
  if (lenis) open ? lenis.stop() : lenis.start();
}
toggle?.addEventListener('click', () => setMenu(menu.hidden));
menu?.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
document.addEventListener('keydown', (e) => e.key === 'Escape' && !menu.hidden && setMenu(false));

/* ---------- Current page in nav ---------- */
const path = location.pathname.replace(/index\.html$/, '') || '/';
document.querySelectorAll('.nav__list a, .mobile-menu a').forEach((a) => {
  if (a.getAttribute('href') === path) a.setAttribute('aria-current', 'page');
});
document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

/* ---------- Nav: a dark pill glides to the hovered link and rests on the current page ---------- */
const navList = document.querySelector('.nav__list');
if (navList) {
  const bubble = document.createElement('span');
  bubble.className = 'nav__bubble';
  bubble.setAttribute('aria-hidden', 'true');
  navList.before(bubble);
  const current = navList.querySelector('a[aria-current="page"]');
  const moveTo = (a) => {
    navList.querySelectorAll('a').forEach((l) => l.classList.toggle('is-lit', l === a));
    if (!a) return bubble.classList.remove('is-on');
    // Measured against the list itself (each <li> is a positioning box, so offsetLeft would read 0)
    bubble.style.width = `${a.offsetWidth}px`;
    bubble.style.transform = `translateX(${a.getBoundingClientRect().left - navList.getBoundingClientRect().left}px)`;
    bubble.classList.add('is-on');
  };
  navList.addEventListener('pointerover', (e) => { const a = e.target.closest('a'); if (a) moveTo(a); });
  navList.addEventListener('focusin', (e) => moveTo(e.target.closest('a')));
  navList.addEventListener('pointerleave', () => moveTo(current));
  navList.addEventListener('focusout', () => moveTo(current));
  // Place it once fonts have set the link widths
  document.fonts?.ready.then(() => moveTo(current));
  moveTo(current);
  window.addEventListener('resize', () => moveTo(current));
}

/* ---------- Generic scroll effects ---------- */
if (!reduceMotion) {
  // Fade-up reveals
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 60, autoAlpha: 0, duration: 1.2, ease: 'expo.out',
      delay: parseFloat(el.dataset.reveal) || 0,
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });

  // Grids whose children swing up in 3D, one after another
  gsap.utils.toArray('[data-stagger]').forEach((grid) => {
    gsap.from(grid.children, {
      rotateX: 55, y: 90, z: -120, autoAlpha: 0, transformOrigin: '50% 100%',
      duration: 1.3, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: grid, start: 'top 85%' },
    });
  });

  // Layered service photos separate in depth as they scroll past
  gsap.utils.toArray('[data-offer-media]').forEach((m) => {
    const [back, front] = m.querySelectorAll('img');
    const st = { trigger: m, start: 'top bottom', end: 'bottom top', scrub: true };
    gsap.fromTo(back, { rotateY: 14, z: -80 }, { rotateY: -6, z: 0, ease: 'none', scrollTrigger: st });
    gsap.fromTo(front, { z: 40, yPercent: 25 }, { z: 160, yPercent: -15, ease: 'none', scrollTrigger: { ...st } });
  });

  // Section headings rise line by line. Headings a section animates itself are skipped: two
  // "from" tweens on one element race, and the second can end the heading at opacity 0.
  gsap.utils.toArray('.h2, .display, .page-hero h1').filter((el) => !el.closest('.tastes__head')).forEach((el) => {
    gsap.from(el, {
      yPercent: 30, autoAlpha: 0, rotateX: -35, transformOrigin: '50% 100%', duration: 1.3, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
  });

  // Parallax images inside a frame
  gsap.utils.toArray('[data-parallax-img]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -9 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // Page hero background drift
  gsap.utils.toArray('.page-hero__media').forEach((m) => {
    gsap.to(m, { yPercent: 12, scale: 1.08, ease: 'none', scrollTrigger: { trigger: m.parentElement, start: 'top top', end: 'bottom top', scrub: true } });
  });

  // 3D tilt on hover (desktop pointers only)
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      const rx = gsap.quickTo(card, 'rotateX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(card, 'rotateY', { duration: 0.6, ease: 'power3' });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 14);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 14);
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }
}

// Animated counters (run even with reduced motion, just instantly)
document.querySelectorAll('[data-count]').forEach((el) => {
  const end = Number(el.dataset.count);
  const fmt = (v) => (el.hasAttribute('data-plain') ? String(Math.round(v)) : Math.round(v).toLocaleString('en-IN'));
  if (reduceMotion) { el.textContent = fmt(end); return; }
  const from = el.hasAttribute('data-plain') ? end - 70 : 0;
  const obj = { v: from };
  el.textContent = fmt(from);
  gsap.to(obj, {
    v: end, duration: 2.2, ease: 'power3.out',
    onUpdate: () => (el.textContent = fmt(obj.v)),
    scrollTrigger: { trigger: el, start: 'top 90%', once: true },
  });
});

/* ---------- Page-specific modules (loaded only where needed) ---------- */
const modules = [
  ['[data-lamp]', () => import('./sections/lamp.js')],
  ['[data-hero]', () => import('./sections/hero.js')],
  ['[data-vhero]', () => import('./sections/vhero.js')],
  ['[data-manifesto]', () => import('./sections/manifesto.js')],
  ['[data-tastes]', () => import('./sections/tastes.js')],
  ['[data-book]', () => import('./sections/book.js')],
  ['[data-wall]', () => import('./sections/wall.js')],
  ['[data-invite]', () => import('./sections/invite.js')],
  ['[data-service-grid]', () => import('./sections/services.js')],
  ['[data-spotlight]', () => import('./sections/spotlight.js')],
  ['[data-dest-stack]', () => import('./sections/destinations.js')],
  ['[data-voice]', () => import('./sections/voices.js')],
  ['[data-enquiry-form]', () => import('./sections/form.js')],
  ['[data-portfolio]', () => import('./sections/portfolio.js')],
  ['[data-gallery]', () => import('./sections/gallery.js')],
];
for (const [sel, load] of modules) {
  const el = document.querySelector(sel);
  if (el) load().then((m) => m.default(el, { reduceMotion, lenis }));
}
// Old-site film bands: play only while on screen
if (document.querySelector('[data-film]')) import('./sections/film.js').then((m) => m.default({ reduceMotion }));
if (reduceMotion) document.querySelectorAll('[data-vhero] video').forEach((v) => v.pause());

// The invitation form on home uses the same enquiry logic as the contact page
document.querySelectorAll('[data-enquiry-form]').forEach((form, i) => {
  if (i > 0) import('./sections/form.js').then((m) => m.default(form));
});

// Magnetic buttons, silk page transitions
import('./flourish.js').then((m) => m.default({ reduceMotion, lenis }));

// Recalculate pinned sections once fonts and images settle.
window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
