import gsap from 'gsap';

// Splits the quote into words; scroll "lights" them one by one. *word* marks an accent word.
export default function manifesto(el, { reduceMotion }) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words
    .map((w) => {
      const accent = /^\*.*\*[.,!?]*$/.test(w);
      const clean = w.replace(/\*/g, '');
      return `<span class="word${accent ? ' is-accent' : ''}">${clean}</span>`;
    })
    .join(' ');
  const spans = el.querySelectorAll('.word');
  if (reduceMotion) { spans.forEach((s) => s.classList.add('is-lit')); return; }

  gsap.to({}, {
    scrollTrigger: {
      trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true,
      onUpdate: ({ progress }) => {
        const lit = Math.round(progress * spans.length);
        spans.forEach((s, i) => s.classList.toggle('is-lit', i < lit));
      },
    },
  });
}
