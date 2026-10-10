// Scroll entrances: subtle, once, progressive.
// Nothing is hidden until this runs, sections already on screen are left
// alone, focus reveals at once, and print shows everything (global.css).
export function initReveal() {
  if (!('IntersectionObserver' in window)) return;
  const targets = [...document.querySelectorAll<HTMLElement>('main .section:not([data-cine])')].filter(
    (el) => el.getBoundingClientRect().top > window.innerHeight,
  );
  if (!targets.length) return;

  const show = (el: HTMLElement, i: number) => {
    io.unobserve(el);
    el.style.setProperty('--i', String(i));
    el.dataset.reveal = 'shown';
  };
  const io = new IntersectionObserver(
    (entries) => {
      let i = 0;
      for (const e of entries) if (e.isIntersecting) show(e.target as HTMLElement, i++);
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of targets) {
    el.dataset.reveal = 'pending';
    io.observe(el);
  }
  document.documentElement.classList.add('reveal-ready');

  document.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-reveal="pending"]');
    if (!el) return;
    el.style.transition = 'none';
    show(el, 0);
  });
}
