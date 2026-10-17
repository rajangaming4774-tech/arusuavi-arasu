import gsap from 'gsap';

// Sticky stacked cards: as the next card slides over, the one beneath tips back into depth.
export default function destinations(stack, { reduceMotion }) {
  if (reduceMotion) return;
  const cards = gsap.utils.toArray('.dest', stack);
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    const tl = gsap.timeline({
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 15%', scrub: true },
    });
    tl.to(card, { scale: 0.88, rotateX: 12, ease: 'none' }, 0)
      .to(card.querySelector('.dest__shade'), { opacity: 0.55, ease: 'none' }, 0);
    gsap.fromTo(next.querySelector('img'), { scale: 1.25 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 15%', scrub: true },
    });
  });
}
