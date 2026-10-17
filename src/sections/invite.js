import gsap from 'gsap';

// Wedding-invitation enquiry: the wax seal breaks, the flap lifts,
// and the invitation card (with the enquiry form) rises out of the envelope.
export default function invite(section, { reduceMotion }) {
  if (reduceMotion) return;
  const envelope = section.querySelector('[data-envelope]');
  const flap = section.querySelector('[data-flap]');
  const card = section.querySelector('[data-invite-card]');
  const sealL = section.querySelector('[data-seal-l]');
  const sealR = section.querySelector('[data-seal-r]');
  const intro = section.querySelector('[data-invite-intro]');
  const back = section.querySelector('.envelope__back');
  const front = section.querySelector('.envelope__front');

  // Card rises out of the envelope by roughly its own height above the pocket
  const lift = () => -(card.offsetHeight * 0.72);
  // While sealed, only the part of the card inside the envelope is drawn
  const hidden = () => `inset(0px 0px ${Math.max(0, card.offsetTop + card.offsetHeight - envelope.offsetHeight + 4)}px 0px)`;
  gsap.set(card, { clipPath: hidden });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.7, invalidateOnRefresh: true },
  });
  tl.fromTo(envelope, { rotateX: 28, y: 80, scale: 0.9 }, { rotateX: 0, y: 0, scale: 1, duration: 0.14, ease: 'power2.out' }, 0)
    // seal cracks and falls away
    .to(sealL, { x: -40, y: 160, rotation: -40, autoAlpha: 0, duration: 0.12, ease: 'power2.in' }, 0.16)
    .to(sealR, { x: 40, y: 170, rotation: 35, autoAlpha: 0, duration: 0.12, ease: 'power2.in' }, 0.16)
    // flap opens; it goes behind the card once past vertical
    .to(flap, { rotateX: 180, duration: 0.14, ease: 'power2.inOut' }, 0.24)
    .set(flap, { zIndex: 1 }, 0.31)
    // card rises (the heading fades first so the opening flap never covers it)
    .to(intro, { autoAlpha: 0, y: -30, duration: 0.07 }, 0.17)
    .to(card, { y: lift, duration: 0.2, ease: 'power2.out' }, 0.38)
    .fromTo(card, { clipPath: hidden }, { clipPath: 'inset(0px 0px 0px 0px)', duration: 0.2, ease: 'power2.out' }, 0.38)
    .set(card, { zIndex: 5 }, 0.5)
    // envelope sinks away and the card settles centre stage
    .to([back, front, flap], { y: () => window.innerHeight * 0.7, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, 0.56)
    .to(card, { y: () => -card.offsetTop + (envelope.offsetHeight - card.offsetHeight) / 2 + 20, scale: 1.04, duration: 0.18, ease: 'power2.inOut' }, 0.56)
    .to({}, { duration: 0.26 });
}
