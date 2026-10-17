import gsap from 'gsap';

// Service cards flip up from the floor as the grid scrolls into view.
export default function services(grid, { reduceMotion }) {
  if (reduceMotion) return;
  gsap.from(grid.children, {
    rotateX: 75, y: 140, z: -200, autoAlpha: 0, transformOrigin: '50% 100%',
    duration: 1.5, ease: 'expo.out', stagger: 0.12,
    scrollTrigger: { trigger: grid, start: 'top 82%' },
  });
}
