import gsap from 'gsap';

// Opening: scroll lights the five wicks one by one, the glow fills the room,
// then a red bloom opens out of the flame into the feast hero below.
export default function lamp(section, { reduceMotion }) {
  if (reduceMotion) return;
  const flames = section.querySelectorAll('.flame');
  const lampImg = section.querySelector('.lamp img');
  const glow = section.querySelector('[data-lamp-glow]');
  const line = section.querySelector('[data-lamp-line]');
  const cue = section.querySelector('[data-lamp-cue]');
  const bloom = section.querySelector('[data-lamp-bloom]');
  const top = section.querySelector('.lamp-intro__top');

  // Centre wick first, then outwards, the way a lamp is traditionally lit.
  const order = [2, 1, 3, 0, 4].map((i) => flames[i]);

  // A small pilot flame on load so the screen is never empty.
  gsap.fromTo(order[0], { scale: 0 }, { scale: 0.45, duration: 1.4, ease: 'expo.out', delay: 0.4 });
  gsap.from([top, section.querySelector('.lamp')], { y: 40, autoAlpha: 0, duration: 1.6, ease: 'expo.out', stagger: 0.15 });

  // The lamp plays over the first part of the hero's pinned scroll (see LAMP_SCREENS in hero.js)
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: section.closest('[data-hero]'), start: 'top top', end: () => `+=${window.innerHeight * 1.2}`, scrub: 0.6, invalidateOnRefresh: true },
  });
  tl.to(cue, { autoAlpha: 0, duration: 0.05 }, 0);
  order.forEach((flame, i) => {
    tl.fromTo(flame, { scale: i === 0 ? 0.45 : 0 }, { scale: 1, duration: 0.08, ease: 'back.out(2.5)' }, 0.04 + i * 0.09);
  });
  tl.to(glow, { opacity: 1, duration: 0.45 }, 0.04)
    .to(lampImg, { filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.6)) brightness(1.05)', duration: 0.45 }, 0.04)
    .fromTo(line, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.42)
    .to([line, top], { autoAlpha: 0, y: -30, duration: 0.08 }, 0.66)
    .fromTo(bloom, { clipPath: 'circle(0% at 50% 34%)' }, { clipPath: 'circle(150% at 50% 34%)', duration: 0.22, ease: 'power2.in' }, 0.68)
    // The red bloom dissolves into the lit table of the feast scene (and frees its buttons for clicks).
    .to(section, { autoAlpha: 0, duration: 0.1 }, 0.9);
}
