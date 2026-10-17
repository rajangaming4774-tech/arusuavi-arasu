import gsap from 'gsap';

// Six taste panels; one is open at a time. While the row is on screen it turns to the next taste on
// its own (a gold line counts down); hovering pauses it and a tap or click opens that taste for good.
const TICK = 5; // seconds per taste

export default function tastes(section, { reduceMotion }) {
  const row = section.querySelector('[data-tastes-row]');
  const panels = [...row.querySelectorAll('[data-taste]')];
  let on = 0;
  let timer = 0;
  let auto = !reduceMotion;
  let inView = false;
  let hovering = false;
  row.style.setProperty('--tick', `${TICK}s`);

  function open(i) {
    on = i;
    panels.forEach((p, k) => {
      p.classList.toggle('is-on', k === i);
      p.setAttribute('aria-expanded', k === i ? 'true' : 'false');
    });
  }
  function run() {
    clearTimeout(timer);
    const going = auto && inView && !hovering;
    row.classList.toggle('is-auto', going);
    if (!going) return;
    // Restart the countdown line on the open panel
    const line = panels[on].querySelector('.taste__time');
    line.style.animation = 'none';
    void line.offsetWidth;
    line.style.animation = '';
    timer = setTimeout(() => { open((on + 1) % panels.length); run(); }, TICK * 1000);
  }
  const choose = (i) => { auto = false; open(i); run(); };

  panels.forEach((p, i) => {
    p.addEventListener('click', () => choose(i));
    p.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); panels[(i + 1) % panels.length].focus(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); panels[(i + panels.length - 1) % panels.length].focus(); }
    });
    // On a mouse, resting on a panel opens it (after a beat, so sweeping across doesn't flicker)
    let hold = 0;
    p.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hold = setTimeout(() => { if (on !== i) open(i); }, 160);
    });
    p.addEventListener('pointerleave', () => clearTimeout(hold));
  });
  row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; run(); } });
  row.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hovering = false; run(); } });

  open(0);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; run(); }, { threshold: 0.35 }).observe(row);

  if (reduceMotion) return;
  gsap.from(panels, {
    y: 60, autoAlpha: 0, duration: 1.3, stagger: 0.08, ease: 'expo.out',
    scrollTrigger: { trigger: row, start: 'top 85%' },
  });
  gsap.from(section.querySelectorAll('.tastes__head > *'), {
    y: 24, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out',
    scrollTrigger: { trigger: section, start: 'top 70%' },
  });
}
