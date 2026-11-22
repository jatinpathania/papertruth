const EASE = [0.16, 1, 0.3, 1];
const SPRING = [0.34, 1.56, 0.64, 1];

// Page transition: opacity only, and short. Animating y/scale on a whole page
// subtree forces a repaint of everything and made navigation feel laggy.
export const fadeUp = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.26, ease: 'linear' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'linear' } }
};

export const staggerContainer = {
  initial: 'initial',
  animate: 'animate',
  variants: { animate: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }
};

export const staggerItem = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } }
};

export const popIn = {
  initial: { opacity: 0, scale: 0.94 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: EASE } }
};

export const EASE_OUT = EASE;

// A vocabulary of scroll-reveal motions. Sections pick one by name so that two
// blocks on the same page never enter the same way. All of them stay on opacity
// plus a 2D transform — the earlier 3D rotations layerised every revealed block.
export const REVEAL = {
  rise: {
    from: { opacity: 0, y: 28 },
    to: { opacity: 1, y: 0 },
    transition: { duration: 0.55, ease: EASE }
  },
  slideLeft: {
    from: { opacity: 0, x: -56 },
    to: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: EASE }
  },
  slideRight: {
    from: { opacity: 0, x: 56 },
    to: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: EASE }
  },
  wipe: {
    from: { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
    to: { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
    transition: { duration: 0.6, ease: EASE }
  },
  wipeSide: {
    from: { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
    to: { opacity: 1, clipPath: 'inset(0 0% 0 0)' },
    transition: { duration: 0.65, ease: EASE }
  },
  zoom: {
    from: { opacity: 0, scale: 0.86 },
    to: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, ease: SPRING }
  },
  swing: {
    from: { opacity: 0, rotate: -3, y: 34, transformOrigin: 'left bottom' },
    to: { opacity: 1, rotate: 0, y: 0, transformOrigin: 'left bottom' },
    transition: { duration: 0.6, ease: SPRING }
  },
  settle: {
    from: { opacity: 0, y: -26, scale: 1.04 },
    to: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.65, ease: EASE }
  }
};

export const REVEAL_NAMES = Object.keys(REVEAL);
