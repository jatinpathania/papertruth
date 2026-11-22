import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import appBg from '../assets/backgrounds/app.webp';
import authBg from '../assets/backgrounds/auth.webp';
import resultsBg from '../assets/backgrounds/results.webp';
import disputesBg from '../assets/backgrounds/disputes.webp';
import adminBg from '../assets/backgrounds/admin.webp';

const SCENES = {
  app: { src: appBg, orbA: 'var(--brand)', orbB: 'var(--accent)' },
  auth: { src: authBg, orbA: 'var(--brand)', orbB: 'var(--accent)' },
  results: { src: resultsBg, orbA: 'var(--ok)', orbB: 'var(--brand)' },
  disputes: { src: disputesBg, orbA: 'var(--method-sp)', orbB: 'var(--danger)' },
  admin: { src: adminBg, orbA: 'var(--brand)', orbB: 'var(--info)' }
};

export function sceneForPath(pathname) {
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) return 'auth';
  if (pathname.startsWith('/admin')) return 'admin';
  if (/^\/exams\/[^/]+\/results/.test(pathname)) return 'results';
  if (/^\/exams\/[^/]+\/disputes/.test(pathname)) return 'disputes';
  return 'app';
}

function useShownScene(scene) {
  const [shown, setShown] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.src = SCENES[scene].src;
    const done = () => !cancelled && setShown(scene);
    if (image.decode) image.decode().then(done, done);
    else {
      image.onload = done;
      image.onerror = done;
    }
    return () => {
      cancelled = true;
    };
  }, [scene]);
  return shown;
}

export default function Backdrop() {
  const { pathname } = useLocation();
  const scene = sceneForPath(pathname);
  const { orbA, orbB } = SCENES[scene];
  const shown = useShownScene(scene);
  const reduce = useReducedMotion();
  const cursorRef = useRef(null);

  // Only the small cursor glow follows the pointer. Transforming the full-screen
  // image layer on every mouse frame repainted the whole page behind it.
  useEffect(() => {
    if (reduce || !window.matchMedia('(pointer: fine)').matches) return undefined;
    let frame = 0;
    let point = null;
    const apply = () => {
      frame = 0;
      if (!point || !cursorRef.current) return;
      cursorRef.current.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
      cursorRef.current.classList.add('on');
    };
    const onMove = (event) => {
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => cursorRef.current?.classList.remove('on');
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [reduce]);

  return (
    <div className="backdrop" data-scene={scene} aria-hidden="true" style={{ '--orb-a': orbA, '--orb-b': orbB }}>
      <div className="backdrop-parallax">
        <AnimatePresence initial={false}>
          {shown && (
            <motion.div
              key={shown}
              className="backdrop-image"
              style={{ backgroundImage: `url(${SCENES[shown].src})` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'linear' }}
            />
          )}
        </AnimatePresence>
      </div>
      <div className="backdrop-shade" />
      <div className="backdrop-orb one" />
      <div className="backdrop-orb two" />
      <div ref={cursorRef} className="backdrop-cursor" />
      <div className="backdrop-grain" />
    </div>
  );
}
