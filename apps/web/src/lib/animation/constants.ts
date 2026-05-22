export const MOTION_EASE = {
  entrance: 'outCubic',
  emphasis: 'outBack',
  smooth: 'inOutSine',
  dramatic: 'outExpo',
  exit: 'inCubic',
} as const;

export const MOTION_DURATION = {
  fast: 220,
  normal: 320,
  medium: 420,
  slow: 600,
  page: 260,
  welcomeChars: 600,
  welcomeName: 420,
  loadingLoop: 1200,
  dialogIn: 260,
  dialogOut: 180,
  redirectDelay: 2000,
  preloadTimeout: 8000,
} as const;

export const MOTION_STAGGER = {
  tight: 35,
  compact: 40,
  normal: 45,
  relaxed: 120,
} as const;

export const MOTION_DELAY = {
  none: 0,
  short: 240,
  medium: 350,
} as const;

export const MOTION_OFFSET = {
  tiny: 6,
  small: 8,
  card: 10,
  panel: 12,
  title: 28,
} as const;

export const MOTION_SCALE = {
  subtle: [1, 1.18, 1] as const,
  cardIn: [0.98, 1] as const,
  dialogIn: [0.98, 1] as const,
  dialogOut: [1, 0.98] as const,
} as const;
