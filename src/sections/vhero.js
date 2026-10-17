import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Home hero: one AI-generated film of an ultra-luxury wedding (seven scenes joined with dissolves).
// The stage pins (CSS sticky). Left alone at the top, the whole film plays by itself, captions
// following its time, then holds on the finale and starts over. Once the visitor scrolls, the page
// jumps (invisibly, the stage is pinned) to the scroll position that matches the frame on screen,
// and from there the scroll drives the playhead: down plays forward, up rewinds. At the very end
// the manifesto slides up over the still-pinned stage.
const BRAND_END = 0.05; // share of the story scroll before the film starts to scrub
const FILM_END = 0.93; // after this the finale shows over the last frame
const BRAND_HOLD = 6; // while playing on its own, the brand stays up for the film's first seconds
const FINALE_HOLD = 6000; // ms the finale stays up after the film ends on its own, before it restarts

export default function vhero(section, { reduceMotion, lenis }) {
  const q = (s) => section.querySelector(s);
  cinema(section, lenis);
  rotor(q('[data-rotor]'), reduceMotion);

  const stage = q('[data-vhero-stage]');
  const reel = q('[data-reel]');
  const reelRev = q('[data-reel-rev]'); // the same film reversed, played when scrolling up
  const scenes = q('.vhero__scenes');
  const times = reel.dataset.chapters.split(',').map(Number);
  const brand = q('[data-step-panel="brand"]');
  const chapters = [...section.querySelectorAll('.vhero__chapter')];
  const finale = q('.vhero__finale');
  const rail = [...section.querySelectorAll('[data-goto]')];
  const bar = q('[data-progress]');
  const duration = () => reel.duration || 49.42;

  let step = -1;
  let visible = true;
  let scrubbing = false;
  let target = 0;
  let raf = 0;
  let dir = 1; // 1: the forward film is showing, -1: the reversed film is showing

  // Phones get the 720p copies, desktops the 1080p films. The forward film STREAMS: it starts as soon
  // as its first seconds arrive, and forward scrolling plays it rather than seeking. The reversed film
  // (a second, equally large file) only starts loading the first time the visitor scrolls up.
  const phone = window.matchMedia('(max-width: 760px)').matches;
  const pick = (v) => (phone ? v.dataset.srcPhone : v.dataset.src);
  reel.preload = 'auto';
  reel.src = pick(reel);
  reel.addEventListener('loadeddata', () => intro(), { once: true });
  const wakeReverse = () => {
    if (!reelRev || reelRev.getAttribute('src')) return;
    reelRev.preload = 'auto';
    reelRev.src = pick(reelRev);
  };
  // Park the hidden reversed film on the matching moment so the browser downloads that stretch
  // (it only buffers a paused video around its playhead); the next scroll-up can then play at once.
  const primeReverse = () => {
    if (!reelRev || dir === -1) return;
    wakeReverse();
    const t = Math.max(0, (reel.duration || 49.42) - reel.currentTime - 1 / 24);
    if (reelRev.readyState >= 1 && !reelRev.seeking && Math.abs(reelRev.currentTime - t) > 0.5) reelRev.currentTime = t;
  };

  function show(s) {
    if (s === step) return;
    step = s;
    brand.classList.toggle('is-off', s !== 0);
    chapters.forEach((c, i) => c.classList.toggle('is-on', s === i + 1));
    finale.classList.toggle('is-on', s === chapters.length + 1);
    rail.forEach((b, i) => b.classList.toggle('is-on', s === i + 1));
    stage.classList.toggle('is-story', s > 0);
    stage.classList.toggle('is-finale', s === chapters.length + 1);
  }

  // Until the visitor scrolls, the whole film plays by itself at normal speed
  let finaleT = 0;
  const atStory = (t) => BRAND_END + Math.min(1, t / (duration() - 0.05)) * (FILM_END - BRAND_END);
  function intro() {
    if (reduceMotion || scrubbing || !visible || finaleT) return;
    reel.playbackRate = 1;
    reel.play().catch(() => {});
  }
  reel.addEventListener('timeupdate', () => {
    if (scrubbing || finaleT) return;
    const t = reel.currentTime;
    bar.style.transform = `scaleX(${atStory(t)})`;
    show(t < BRAND_HOLD ? 0 : 1 + times.reduce((k, c, i) => (t >= c - 0.4 ? i : k), 0));
  });
  // At the end it rests on the finale, then begins again from the brand
  reel.addEventListener('ended', () => {
    if (scrubbing) return;
    show(chapters.length + 1);
    bar.style.transform = `scaleX(${FILM_END})`;
    finaleT = setTimeout(() => {
      finaleT = 0;
      if (scrubbing) return;
      reel.currentTime = 0;
      show(0);
      intro();
    }, FINALE_HOLD);
  });

  // Follow the scroll target without stutter and at full quality in BOTH directions. The film PLAYS
  // (smooth, hardware-decoded) at a speed matched to the gap instead of seeking every frame: forward
  // on the normal film, and when scrolling up, forward on the reversed film. The two swap on the same
  // frame once the incoming one has finished seeking, so the switch is invisible. Big jumps seek.
  // The reversed film can take over only once the stretch it needs has downloaded
  const revReady = () => {
    if (!reelRev || reelRev.readyState < 1) return false;
    if (dir === -1) return true;
    const t = Math.max(0, duration() - reel.currentTime - 1 / 24);
    const b = reelRev.buffered;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= t && b.end(i) >= Math.min(t + 1, duration())) return true;
    return false;
  };
  const mirror = (t) => Math.max(0, duration() - t - 1 / 24);
  const position = () => (dir === 1 ? reel.currentTime : mirror(reelRev.currentTime));
  function swapTo(d) {
    if (d === dir) return;
    const [from, to] = d === -1 ? [reel, reelRev] : [reelRev, reel];
    from.pause();
    to.currentTime = mirror(from.currentTime);
    dir = d;
    to.addEventListener('seeked', () => scenes.classList.toggle('is-rev', dir === -1), { once: true });
  }
  function drive(v, gap) {
    v.playbackRate = Math.min(6, Math.max(0.4, gap * 2.5));
    if (v.paused && !v.seeking) v.play().catch(() => {});
  }
  function settle() {
    reel.pause();
    reel.playbackRate = 1;
    if (reelRev) { reelRev.pause(); reelRev.playbackRate = 1; }
    primeReverse();
  }
  function follow() {
    raf = 0;
    if (!scrubbing) return;
    const gap = target - position();
    if (Math.abs(gap) <= 0.05) return settle();
    if (gap < 0 && !revReady()) primeReverse();
    if (gap > 0 && gap < 4) { swapTo(1); drive(reel, gap); }
    else if (gap < 0 && gap > -4 && revReady()) { swapTo(-1); drive(reelRev, -gap); }
    else { swapTo(1); reel.pause(); if (!reel.seeking) reel.currentTime = target; }
    raf = requestAnimationFrame(follow);
  }

  show(0);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!visible) { reel.pause(); reelRev?.pause(); }
    else intro();
  }).observe(stage);
  if (reduceMotion) return;

  const lines = brand.querySelectorAll('[data-vhero-in]');
  gsap.timeline({ delay: 0.2 })
    .from(reel, { scale: 1.12, duration: 3, ease: 'power2.out' }, 0)
    .from(lines, { y: 34, autoAlpha: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 0.35)
    .from(q('[data-vhero-cue]'), { autoAlpha: 0, duration: 0.8 }, 1.3);

  // The story runs over the section's height minus the pinned screen and the manifesto's cover
  const storyLength = () => section.offsetHeight - 2 * window.innerHeight;
  const scrollY = () => (lenis ? lenis.scroll : window.scrollY);

  // Hand-over from "playing by itself" to scroll. It arms only once the scroll has been still for a
  // moment, so momentum from scrolling back up into the brand zone doesn't bounce the visitor down.
  let armed = false;
  let anchorY = 0;
  let idleT = 0;
  let handing = false;
  let jumping = false; // a rail click is gliding the page down; let it through untouched
  function rearm() {
    armed = false;
    clearTimeout(idleT);
    idleT = setTimeout(() => { armed = true; anchorY = scrollY(); }, 300);
  }
  function handOver(y) {
    handing = true;
    armed = false;
    clearTimeout(idleT);
    clearTimeout(finaleT);
    finaleT = 0;
    const t = reel.ended ? duration() : reel.currentTime;
    scrubbing = true;
    target = t;
    reel.pause();
    // Same frame, now at the scroll position that matches it, plus however far they just scrolled
    const to = story.start + atStory(t) * storyLength() + (y - anchorY);
    requestAnimationFrame(() => {
      if (lenis) lenis.scrollTo(to, { immediate: true, force: true });
      else window.scrollTo(0, to);
      handing = false;
      ScrollTrigger.update();
    });
  }

  const story = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${storyLength()}`,
    invalidateOnRefresh: true,
    onUpdate: ({ progress: p }) => {
      if (handing) return;
      if (p < BRAND_END && jumping && !scrubbing) return;
      if (p >= BRAND_END) jumping = false;
      if (p < BRAND_END) {
        if (scrubbing) {
          // Back at the top: carry on playing by itself from this frame
          scrubbing = false; swapTo(1); scenes.classList.remove('is-rev');
          cancelAnimationFrame(raf); raf = 0;
          reel.playbackRate = 1;
          rearm(); intro();
          return;
        }
        const y = scrollY();
        if (!armed) rearm();
        else if (y > anchorY + 2) handOver(y);
        else anchorY = Math.min(anchorY, y);
        return;
      }
      bar.style.transform = `scaleX(${p})`;
      if (!scrubbing) {
        scrubbing = true;
        clearTimeout(finaleT); finaleT = 0;
        reel.pause();
      }
      const f = Math.min(1, (p - BRAND_END) / (FILM_END - BRAND_END));
      target = f * (duration() - 0.05);
      if (!raf) raf = requestAnimationFrame(follow);
      if (p >= FILM_END) show(chapters.length + 1);
      else show(1 + times.reduce((k, t, i) => (target >= t - 0.4 ? i : k), 0));
    },
  });
  // Armed from the start, so the very first scroll after load continues from the frame on screen
  armed = true;
  anchorY = scrollY();

  // Rail: jump to a chapter (a little past its start so its caption is up)
  rail.forEach((b, i) => b.addEventListener('click', () => {
    const f = Math.min(1, (times[i] + 1.5) / duration());
    const y = story.start + (BRAND_END + f * (FILM_END - BRAND_END)) * storyLength();
    if (!scrubbing) jumping = true;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  }));

  // Skip intro: fade the film out, then jump straight to the manifesto (no long scrub through the story)
  const skip = q('[data-vhero-skip]');
  const next = document.getElementById('main-start');
  if (skip && next) skip.addEventListener('click', (e) => {
    e.preventDefault();
    const y = next.getBoundingClientRect().top + window.scrollY;
    stage.classList.add('is-skipping');
    setTimeout(() => {
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo({ top: y, behavior: 'instant' });
      setTimeout(() => stage.classList.remove('is-skipping'), 100);
      next.focus?.({ preventScroll: true });
    }, 450);
  });

  // As the manifesto rises over the pinned stage, the film dims softly underneath
  const cover = { trigger: section.nextElementSibling, start: 'top bottom', end: 'top top', scrub: true };
  gsap.to(q('.vhero__scenes'), { filter: 'brightness(0.45)', ease: 'none', scrollTrigger: cover });
}

// The last word of the tagline turns over every few seconds; the slot eases to each word's width.
function rotor(el, reduceMotion) {
  if (!el || reduceMotion) return;
  const words = [...el.children];
  let i = 0;
  const fit = () => (el.style.width = `${words[i].offsetWidth}px`);
  words[0].classList.add('is-on');
  document.fonts?.ready.then(fit);
  fit();
  window.addEventListener('resize', fit);
  setInterval(() => {
    if (document.hidden) return;
    words[i].classList.replace('is-on', 'is-off');
    const prev = words[i];
    setTimeout(() => prev.classList.remove('is-off'), 650);
    i = (i + 1) % words.length;
    words[i].classList.add('is-on');
    fit();
  }, 2600);
}

// "Watch our film": the full film in a dark cinema dialog; page scroll pauses while it is open.
function cinema(section, lenis) {
  const box = section.querySelector('[data-cinema]');
  const open = section.querySelector('[data-film-open]');
  if (!box || !open) return;
  const film = box.querySelector('[data-cinema-video]');
  // Clean up here rather than on the dialog's close event, which some embedded browsers never fire
  const close = () => { film.pause(); box.close(); lenis?.start(); };
  open.addEventListener('click', () => {
    lenis?.stop();
    box.showModal();
    film.play().catch(() => {});
  });
  box.querySelector('[data-cinema-close]').addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  box.addEventListener('cancel', (e) => { e.preventDefault(); close(); }); // Esc
}
