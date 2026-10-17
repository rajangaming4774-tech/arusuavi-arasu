import gsap from 'gsap';

/*
 * Finishing touches used on every page:
 *  - buttons that lean toward the pointer
 *  - a red silk wipe between pages
 */
export default function flourish({ reduceMotion, lenis }) {
  pageWipe(reduceMotion);
  if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  magnetic();
}

function magnetic() {
  document.querySelectorAll('.btn, .wa-float').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.28);
      y((e.clientY - (r.top + r.height / 2)) * 0.36);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}

function pageWipe(reduceMotion) {
  const wipe = document.querySelector('[data-page-wipe]');
  if (!wipe) return;
  const KEY = 'aa-wipe';
  const arriving = document.documentElement.classList.contains('is-wiping');
  // Hand the position over from CSS to GSAP so the two offsets never stack.
  gsap.set(wipe, { y: 0, yPercent: arriving ? 0 : 110 });

  // Arriving from another page: the silk slides up and away.
  if (arriving) {
    sessionStorage.removeItem(KEY);
    gsap.fromTo(wipe, { yPercent: 0 }, {
      yPercent: -110, duration: reduceMotion ? 0.01 : 1.1, ease: 'expo.inOut', delay: 0.15,
      onComplete: () => document.documentElement.classList.remove('is-wiping'),
    });
  }

  // Leaving: the silk rises from below, then we navigate.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    if (!/(\.html|\/)$/.test(url.pathname)) return;
    e.preventDefault();
    sessionStorage.setItem(KEY, '1');
    gsap.fromTo(wipe, { yPercent: 110 }, {
      yPercent: 0, duration: reduceMotion ? 0.01 : 0.8, ease: 'expo.inOut',
      onComplete: () => (location.href = url.href),
    });
  });

  // Coming back via the browser's back button shows the cached page: clear the silk.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) { gsap.set(wipe, { yPercent: 110 }); document.documentElement.classList.remove('is-wiping'); }
  });
}
