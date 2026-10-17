import gsap from 'gsap';

// Testimonial portraits turn toward the reader; signatures write themselves in gold.
export default function voices(_, { reduceMotion }) {
  if (reduceMotion) {
    document.querySelectorAll('.script-name text').forEach((t) => (t.style.fillOpacity = 1));
    return;
  }
  gsap.utils.toArray('[data-voice]').forEach((voice, i) => {
    const media = voice.querySelector('[data-voice-media]');
    const text = media.nextElementSibling;
    gsap.fromTo(media,
      { rotateY: i % 2 ? -28 : 28, scale: 0.86, autoAlpha: 0.4 },
      { rotateY: 0, scale: 1, autoAlpha: 1, ease: 'none', scrollTrigger: { trigger: voice, start: 'top bottom', end: 'center 60%', scrub: true } });
    gsap.from(text.querySelectorAll('.quote, .quote-by, .voice__note'), {
      y: 50, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1,
      scrollTrigger: { trigger: voice, start: 'top 70%' },
    });

    // Real signature image: revealed left to right like a pen moving
    const sign = voice.querySelector('.voice__sign');
    if (sign) {
      gsap.fromTo(sign, { clipPath: 'inset(0 100% 0 0)' }, {
        clipPath: 'inset(0 0% 0 0)', duration: 2.4, ease: 'power1.inOut', delay: 0.5,
        scrollTrigger: { trigger: voice, start: 'top 60%' },
      });
    }

    // Names in a script font: the outline is traced, then filled with gold
    const name = voice.querySelector('.script-name text');
    if (name) {
      const len = Math.ceil(name.getComputedTextLength() * 3.2);
      gsap.set(name, { strokeDasharray: len, strokeDashoffset: len });
      gsap.timeline({ scrollTrigger: { trigger: voice, start: 'top 60%' }, delay: 0.5 })
        .to(name, { strokeDashoffset: 0, duration: 2.6, ease: 'power1.inOut' })
        .to(name, { fillOpacity: 1, duration: 0.8 }, '-=0.6');
    }
  });
}
