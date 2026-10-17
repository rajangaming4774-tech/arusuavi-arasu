import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Gallery: category filter, film tiles that preview on hover, and a <dialog> lightbox.
export default function gallery(section, { reduceMotion, lenis }) {
  const buttons = section.querySelectorAll('[data-filter]');
  const items = [...section.querySelectorAll('[data-gallery-item]')];
  const box = section.querySelector('[data-lightbox]');
  const stage = box.querySelector('[data-lightbox-stage]');
  const count = box.querySelector('[data-lightbox-count]');

  /* ---------- Filter ---------- */
  const visible = () => items.filter((i) => !i.hidden);
  const show = (cat) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
    items.forEach((i) => (i.hidden = !(cat === 'all' || i.dataset.cat === cat)));
    ScrollTrigger.refresh();
    if (!reduceMotion) {
      gsap.fromTo(visible().slice(0, 16), { y: 40, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, ease: 'expo.out', stagger: 0.03, overwrite: true });
    }
  };
  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.filter)));

  if (!reduceMotion) {
    ScrollTrigger.batch(items, {
      start: 'top 92%', once: true,
      onEnter: (batch) => gsap.from(batch, { y: 60, autoAlpha: 0, duration: 1, ease: 'expo.out', stagger: 0.05 }),
    });
  }

  /* ---------- Film tiles: muted preview on hover ---------- */
  if (!reduceMotion && matchMedia('(hover: hover)').matches) {
    items.filter((i) => 'video' in i.dataset).forEach((tile) => {
      let v;
      tile.addEventListener('mouseenter', () => {
        v ??= Object.assign(document.createElement('video'), { src: tile.href, muted: true, loop: true, playsInline: true });
        v.className = 'gallery__preview';
        tile.append(v);
        v.play().catch(() => {});
      });
      tile.addEventListener('mouseleave', () => { v?.pause(); v?.remove(); });
    });
  }

  /* ---------- Lightbox ---------- */
  let list = [];
  let at = 0;
  const render = () => {
    const item = list[at];
    const img = item.querySelector('img');
    stage.replaceChildren();
    if ('video' in item.dataset) {
      const v = Object.assign(document.createElement('video'), {
        src: item.href, controls: true, autoplay: true, playsInline: true, poster: img.src,
      });
      v.setAttribute('aria-label', img.alt);
      stage.append(v);
    } else {
      const big = Object.assign(document.createElement('img'), { src: item.href, alt: img.alt });
      stage.append(big);
    }
    count.textContent = `${at + 1} / ${list.length}`;
  };
  const go = (d) => { at = (at + d + list.length) % list.length; render(); };
  const close = () => { stage.replaceChildren(); box.close(); lenis?.start(); };

  items.forEach((item) => item.addEventListener('click', (e) => {
    e.preventDefault();
    list = visible();
    at = list.indexOf(item);
    render();
    lenis?.stop();
    box.showModal();
  }));
  box.querySelector('[data-lightbox-prev]').addEventListener('click', () => go(-1));
  box.querySelector('[data-lightbox-next]').addEventListener('click', () => go(1));
  box.querySelector('[data-lightbox-close]').addEventListener('click', close);
  box.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  box.addEventListener('click', (e) => { if (e.target === box || e.target === stage) close(); });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });

  // Swipe on touch screens
  let x0 = null;
  box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    x0 = null;
  });
}
