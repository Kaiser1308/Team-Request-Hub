'use client';

import { useEffect, useRef } from 'react';
import { animate } from 'animejs';
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_SCALE,
} from '@/lib/animation/constants';

export function AnimeSampleCard() {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = cardRef.current;
    if (!target) {
      return;
    }

    const animation = animate(target, {
      y: [MOTION_OFFSET.panel, 0],
      opacity: [0, 1],
      scale: MOTION_SCALE.cardIn,
      duration: MOTION_DURATION.slow,
      ease: MOTION_EASE.dramatic,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
    >
      <p className='text-sm font-medium text-slate-900'>Anime.js Sample</p>
      <p className='mt-1 text-sm text-slate-600'>
        This card animates on mount with animejs.
      </p>
    </div>
  );
}
