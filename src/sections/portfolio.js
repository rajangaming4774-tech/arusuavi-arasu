import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Category filter: hides non-matching cards, then flips the remaining ones in.
export default function portfolio(section, { reduceMotion }) {
  const buttons = section.querySelectorAll('[data-filter]');
  const cards = [...section.querySelectorAll('[data-cat]')];
  const grid = section.querySelector('[data-portfolio-grid]');

  const show = (cat) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === cat)));
    const visible = cards.filter((c) => {
      const on = cat === 'all' || c.dataset.cat === cat;
      c.hidden = !on;
      return on;
    });
    ScrollTrigger.refresh();
    if (!reduceMotion) {
      gsap.fromTo(visible,
        { rotateY: -60, z: -200, autoAlpha: 0 },
        { rotateY: 0, z: 0, autoAlpha: 1, duration: 1, ease: 'expo.out', stagger: 0.04, overwrite: true });
    }
  };
  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.filter)));

  if (!reduceMotion) {
    ScrollTrigger.batch(cards, {
      start: 'top 90%', once: true,
      onEnter: (batch) => gsap.from(batch, { rotateX: 50, y: 80, autoAlpha: 0, transformOrigin: '50% 100%', duration: 1.2, ease: 'expo.out', stagger: 0.08 }),
    });
  }
  grid.style.minHeight = '40vh';
}
