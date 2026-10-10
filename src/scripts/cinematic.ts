// Cinematic layer for the home hero (see styles/cinematic.css).
// Guard rails: reduced motion runs nothing; touch gets the entrance only (no
// parallax, float or scroll scatter); any key press finishes the intro and
// focus entering the hero settles it; print and no-JS show everything.
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const root = document.documentElement;
const scene = document.querySelector<HTMLElement>('[data-cine="hero"]');
const release = () => root.classList.remove('cine-pending');

if (!scene || matchMedia('(prefers-reduced-motion: reduce)').matches) release();
else init(scene);

function init(scene: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(s: string) => scene.querySelector<T>(s)!;
  const h1 = $('h1');
  const lede = $('.hero > p');
  const stats = $('.stats');
  const search = $('.search');
  const corners = gsap.utils.toArray<HTMLElement>('.cine-corner', scene);
  const hairline = $('.cine-hairline');
  const grid = $('.cine-grid');
  const glow = $('.cine-glow');
  const ghost = $('.cine-ghost');
  const intros = [h1, lede, stats, search, ...corners];

  let introDone = false;
  let linesTween: gsap.core.Tween | undefined;
  let scatter: gsap.core.Timeline | undefined;

  // Masked line reveal. A re-split after the intro must land finished.
  const split = SplitText.create(h1, {
    type: 'lines',
    mask: 'lines',
    autoSplit: true,
    onSplit(self) {
      linesTween = gsap.from(self.lines, { yPercent: 105, duration: 0.8, stagger: 0.08, ease: 'expo.out', delay: introDone ? 0 : 0.05 });
      if (introDone) linesTween.progress(1);
      return linesTween;
    },
  });

  const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: finish });
  intro
    .from(grid, { opacity: 0, duration: 1 }, 0)
    .from(glow, { opacity: 0, scale: 0.85, duration: 1.1 }, 0)
    .from(ghost, { opacity: 0, yPercent: 14, duration: 1.1 }, 0)
    .from(lede, { opacity: 0, y: 10, duration: 0.6 }, 0.25)
    .from(stats, { opacity: 0, y: 8, duration: 0.6 }, 0.35)
    .from(
      // Clip-path wipe from the center; it ends just outside the box so the
      // corners and shadow are never cut, and is cleared on completion.
      search,
      { clipPath: 'inset(0% 50% 0% 50% round 14px)', duration: 0.6, ease: 'expo.inOut' },
      0.4,
    )
    .set(search, { clipPath: 'inset(-16px -16px -16px -16px round 14px)' }, 0.4 + 0.6)
    .from(corners, { opacity: 0, scale: 0.6, duration: 0.45, stagger: 0.04 }, 0.75)
    .fromTo(hairline, { opacity: 1, scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 0.5, ease: 'expo.inOut' }, 0.8)
    .to(hairline, { opacity: 0, duration: 0.4, ease: 'power2.out' }, 1.25);

  // Stats settle on their real numbers.
  stats.querySelectorAll('strong').forEach((el, i) => {
    intro.to(el, { duration: 0.7, scrambleText: { text: el.textContent ?? '', chars: '0123456789', speed: 0.6 } }, 0.35 + i * 0.06);
  });

  // From-states are set; the hero can show.
  release();

  function finish() {
    if (introDone) return;
    introDone = true;
    linesTween?.progress(1);
    if (intro.progress() < 1) intro.progress(1);
    split.revert();
    gsap.set(intros, { clearProps: 'opacity,transform,clipPath' });
    gsap.set(hairline, { opacity: 0 });
    enhanceDesktop();
  }

  // A key press finishes the intro at once.
  window.addEventListener('keydown', finish, { once: true });
  // Keyboard focus entering the hero settles the whole scene.
  scene.addEventListener('focusin', () => {
    finish();
    if (scatter) {
      scatter.scrollTrigger?.kill();
      scatter.progress(0).kill();
      scatter = undefined;
    }
  });

  function enhanceDesktop() {
    const mm = gsap.matchMedia();
    // `always` makes the callback run even when no other condition matches.
    mm.add({ fine: '(hover: hover) and (pointer: fine)', always: 'all' }, (ctx) => {
      if (!ctx.conditions?.fine) return;

      // Scatter on scroll-out. Pointer parallax owns x/y on the layer
      // wrappers, so scroll scrubs use yPercent/xPercent on the inner layers.
      scatter = gsap
        .timeline({ scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom top', scrub: 0.6 } })
        .to(grid, { yPercent: 8, ease: 'none' }, 0)
        .to(glow, { yPercent: 35, opacity: 0, ease: 'none' }, 0)
        .to(ghost, { xPercent: -10, opacity: 0, ease: 'none' }, 0)
        .to(corners[0], { x: -18, y: -12, opacity: 0, ease: 'none' }, 0)
        .to(corners[1], { x: 18, y: -12, opacity: 0, ease: 'none' }, 0)
        .to(corners[2], { x: -18, y: 12, opacity: 0, ease: 'none' }, 0)
        .to(corners[3], { x: 18, y: 12, opacity: 0, ease: 'none' }, 0);

      // Slow float and pointer parallax, paused while the hero is off screen.
      const float = gsap.to(glow, { y: -14, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      const layers = gsap.utils.toArray<HTMLElement>('.cine-layer', scene).map((el) => ({
        k: [4, 10, 16][Number(el.dataset.depth)] ?? 0,
        x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' }),
        y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' }),
      }));
      let active = true;
      const onMove = (e: PointerEvent) => {
        if (!active) return;
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        for (const l of layers) {
          l.x(nx * l.k);
          l.y(ny * l.k);
        }
      };
      window.addEventListener('pointermove', onMove, { passive: true });
      ScrollTrigger.create({
        trigger: scene,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => {
          active = self.isActive;
          if (active) float.play();
          else float.pause();
        },
      });

      return () => window.removeEventListener('pointermove', onMove);
    });
  }
}
