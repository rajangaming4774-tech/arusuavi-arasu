import gsap from 'gsap';

// A palace picture gallery: the camera walks along gilt-framed photos of notable celebrations.
export default function wall(section, { reduceMotion }) {
  if (reduceMotion) return;
  const track = section.querySelector('[data-wall-track]');
  const works = track.querySelectorAll('.artwork');
  const small = () => window.innerWidth < 700;
  const angle = () => (small() ? -9 : -14);
  const endAngle = () => angle() + 8;

  // Set the wall back from the camera so frames read as a gallery, not a close-up
  gsap.set(track, { rotateY: angle(), z: () => (small() ? -220 : -420) });

  // End with the last frame (the "your celebration" invitation) centred on screen.
  // The view is centred on the perspective origin, so after rotating the track about its
  // left edge, a point d along it lands in the middle when x = width/2 - d·cos(angle).
  const travel = () => {
    const last = works[works.length - 1];
    const d = last.offsetLeft + last.offsetWidth / 2;
    return window.innerWidth / 2 - d * Math.cos((endAngle() * Math.PI) / 180);
  };

  // Picture lamps warm up as each frame reaches the middle of the screen
  const light = () => {
    const mid = window.innerWidth / 2;
    works.forEach((w) => {
      const r = w.getBoundingClientRect();
      const d = Math.min(1, Math.abs(r.left + r.width / 2 - mid) / (window.innerWidth * 0.6));
      w.style.setProperty('--lit', (1 - d * 0.75).toFixed(3));
    });
  };
  gsap.to(track, {
    x: travel, ease: 'none', onUpdate: light,
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.9, invalidateOnRefresh: true },
  });
  light();
  // The wall straightens slightly as you walk along it
  gsap.fromTo(track, { rotateY: () => angle() - 10 }, {
    rotateY: endAngle, ease: 'none',
    scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });

  // Real 3D teak pillars drawn over the wall, ticked after GSAP has moved it each frame
  import('./pillar3d.js').then((m) => {
    const tick = m.default(section, track);
    if (tick) gsap.ticker.add(tick);
  });
}
