// Film bands: videos start loading near the viewport and play only while visible.
export default function films({ reduceMotion }) {
  const videos = [...document.querySelectorAll('[data-film] video')];
  if (reduceMotion) return; // posters only

  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.preload = 'auto';
      near.unobserve(e.target);
    }
  }, { rootMargin: '600px 0px' });

  const onScreen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) e.target.play().catch(() => {});
      else e.target.pause();
    }
  }, { threshold: 0.25 });

  videos.forEach((v) => { near.observe(v); onScreen.observe(v); });
}
