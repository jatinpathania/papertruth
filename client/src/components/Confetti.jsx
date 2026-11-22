import { useEffect, useRef, useState } from 'react';

const COLORS = ['#22e2f5', '#7cf3ff', '#c084fc', '#ffb020', '#34e7a8', '#ff5c7a', '#ffffff'];

export default function Confetti({ count = 150, duration = 3200 }) {
  const ref = useRef(null);
  const [done, setDone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (done || !ref.current) return undefined;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const w = window.innerWidth;
    const pieces = Array.from({ length: count }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 50;
      const speed = 9 + Math.random() * 10;
      return {
        x: fromLeft ? w * 0.08 : w * 0.92,
        y: window.innerHeight * 0.75,
        vx: Math.cos((angle * Math.PI) / 180) * speed,
        vy: Math.sin((angle * Math.PI) / 180) * speed,
        size: 5 + Math.random() * 7,
        spin: (Math.random() - 0.5) * 0.3,
        rot: Math.random() * Math.PI,
        tilt: Math.random() * Math.PI,
        color: COLORS[i % COLORS.length]
      };
    });

    const start = performance.now();
    let frame = 0;
    const tick = (now) => {
      const elapsed = now - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fade = Math.max(0, 1 - Math.max(0, elapsed - duration * 0.65) / (duration * 0.35));
      for (const p of pieces) {
        p.vy += 0.28;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.spin;
        p.tilt += 0.12;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.tilt));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      }
      if (elapsed < duration) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [count, duration, done]);

  if (done) return null;
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
