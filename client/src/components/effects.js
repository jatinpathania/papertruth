import { useEffect } from 'react';

export const FX_SELECTOR =
  '.card, .stat, .stat-tile, .exam-card, .step-card, .feature-card, .dispute-tile, .option-tile, .method-card, .explain-card, .qcard, .cta-band, .auth-card, .glass';

const RIPPLE_SELECTOR = 'button, .btn';

export function useGlobalEffects() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let pending = null;
    let lit = null;
    let litRect = null;

    const clearLit = () => {
      if (!lit) return;
      lit.style.setProperty('--mx', '-9999px');
      lit.style.setProperty('--my', '-9999px');
      lit = null;
      litRect = null;
    };

    // Measuring the hovered card once and reusing the box is what keeps this off
    // the layout path; reading it per pointer event forced a reflow every frame.
    const flush = () => {
      frame = 0;
      const event = pending;
      if (!event) return;
      const target = event.target instanceof Element ? event.target : null;
      const surface = target?.closest(FX_SELECTOR) || null;

      if (surface !== lit) {
        clearLit();
        if (surface) {
          lit = surface;
          litRect = surface.getBoundingClientRect();
        }
      }
      if (!lit || !litRect) return;
      lit.style.setProperty('--mx', `${event.clientX - litRect.left}px`);
      lit.style.setProperty('--my', `${event.clientY - litRect.top}px`);
    };

    const onMove = (event) => {
      if (event.pointerType !== 'mouse') return;
      pending = event;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onScroll = () => {
      if (lit) litRect = lit.getBoundingClientRect();
    };

    const onDown = (event) => {
      if (reduce.matches || event.button !== 0) return;
      const host = event.target instanceof Element ? event.target.closest(RIPPLE_SELECTOR) : null;
      if (!host || host.disabled || host.classList.contains('no-ripple')) return;
      const rect = host.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.setAttribute('aria-hidden', 'true');
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      host.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      setTimeout(() => ripple.remove(), 1000);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.documentElement.addEventListener('pointerleave', clearLit);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('pointerleave', clearLit);
    };
  }, []);
}
