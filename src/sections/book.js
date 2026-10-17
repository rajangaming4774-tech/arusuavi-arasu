import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/*
 * Legacy book. The cover opens, then each leaf turns as you scroll.
 * Landscape screens get a side-bound book; portrait screens a top-bound one
 * (like a calendar) so the pages stay readable on phones.
 * Photos start in sepia and gain colour as the story reaches today.
 */
export default function book(section, { reduceMotion }) {
  const el = section.querySelector('[data-book-el]');
  const leaves = [...el.querySelectorAll('.leaf')];
  const turnable = leaves.slice(0, -1); // the last page stays open on "Today"
  const photos = el.querySelectorAll('.page__photo img');
  photos.forEach((img, i) => {
    const t = i / Math.max(1, photos.length - 1);
    img.style.filter = `sepia(${(1 - t) * 0.85}) saturate(${0.6 + t * 0.4}) contrast(${1.05 - t * 0.05})`;
  });
  if (reduceMotion) return;

  const hint = section.querySelector('[data-book-hint]');
  section.style.height = `${(turnable.length + 2) * 60}svh`;
  let tl;

  function stack() {
    const prop = el.classList.contains('book--vertical') ? 'rotationX' : 'rotationY';
    leaves.forEach((leaf, i) => {
      const angle = Math.abs(gsap.getProperty(leaf, prop));
      const turned = angle > 90;
      leaf.style.zIndex = turned ? i + 1 : leaves.length * 2 - i;
      // In 3D, z-index is ignored for coplanar pages: lift each page a hair off the
      // spine so the newest turned page and the next unturned page are on top.
      gsap.set(leaf, { z: turned ? i * 0.6 : (leaves.length - i) * 0.6 });
      leaf.style.setProperty('--shade', Math.sin((angle / 180) * Math.PI).toFixed(3));
    });
  }

  function build() {
    tl?.scrollTrigger?.kill();
    tl?.kill();
    const vertical = window.innerHeight > window.innerWidth;
    el.classList.toggle('book--vertical', vertical);
    gsap.set(leaves, { clearProps: 'transform' });
    const prop = vertical ? 'rotationX' : 'rotationY';
    const turnTo = vertical ? 180 : -180;
    // Closed book sits centred over its right (or bottom) half.
    const closed = vertical ? { yPercent: -25, xPercent: 0 } : { xPercent: -25, yPercent: 0 };

    // Restack on every animation frame (scrub keeps easing after the scroll event fires)
    tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: stack,
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
    });
    gsap.set(el, closed);
    tl.to(hint, { autoAlpha: 0, duration: 0.3 }, 0.2);
    turnable.forEach((leaf, i) => {
      tl.to(leaf, { [prop]: turnTo, duration: 1, ease: 'power1.inOut' }, i * 1.1);
      if (i === 0) tl.to(el, { xPercent: 0, yPercent: 0, duration: 1, ease: 'power1.inOut' }, 0);
    });
    tl.to({}, { duration: 0.6 });
    stack();
  }

  build();
  let wasVertical = window.innerHeight > window.innerWidth;
  window.addEventListener('resize', () => {
    const v = window.innerHeight > window.innerWidth;
    if (v !== wasVertical) { wasVertical = v; build(); ScrollTrigger.refresh(); }
  });
}
