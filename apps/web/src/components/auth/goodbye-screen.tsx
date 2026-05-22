'use client';

import { animate, stagger } from 'animejs';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  MOTION_DELAY,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_STAGGER,
} from '@/lib/animation/constants';
import { getCurrentUser } from '@/lib/api/users';
import { createClient } from '@/lib/supabase/client';

export function GoodbyeScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [statusText, setStatusText] = useState('Ending your session...');
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const nameRef = useRef<HTMLParagraphElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      try {
        const currentUser = await getCurrentUser();
        setDisplayName(
          currentUser.name ??
            currentUser.email?.split('@')[0] ??
            user?.email?.split('@')[0] ??
            'there',
        );
        return;
      } catch {
        // Fall back to Supabase profile metadata
      }

      const name =
        user?.user_metadata?.full_name ??
        user?.user_metadata?.name ??
        user?.email?.split('@')[0] ??
        'there';
      setDisplayName(name);
    };

    void loadUser();
  }, []);

  useEffect(() => {
    const titleEl = titleRef.current;
    if (!titleEl) return;

    const chars = Array.from(titleEl.querySelectorAll<HTMLElement>('[data-char]'));
    if (!chars.length) return;

    const animation = animate(chars, {
      y: [MOTION_OFFSET.title, 0],
      opacity: [0, 1],
      rotateZ: [4, 0],
      delay: stagger(MOTION_STAGGER.normal, { from: 'first' }),
      duration: MOTION_DURATION.welcomeChars,
      ease: MOTION_EASE.dramatic,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, []);

  useEffect(() => {
    const nameEl = nameRef.current;
    if (!nameEl || !displayName) return;

    const animation = animate(nameEl, {
      y: [MOTION_OFFSET.small, 0],
      opacity: [0, 1],
      delay: MOTION_DELAY.medium,
      duration: MOTION_DURATION.welcomeName,
      ease: MOTION_EASE.entrance,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, [displayName]);

  useEffect(() => {
    const statusEl = statusRef.current;
    if (!statusEl) return;

    const animation = animate(statusEl, {
      opacity: [0.35, 1, 0.35],
      duration: MOTION_DURATION.loadingLoop,
      ease: MOTION_EASE.smooth,
      loop: true,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStatusText('Closing workspace...');
    }, MOTION_DELAY.short);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const playFadeOutExit = () =>
      new Promise<void>((resolve) => {
        const textTargets = Array.from(
          screenRef.current?.querySelectorAll<HTMLElement>('[data-goodbye-content]') ?? [],
        );
        const rootTargets = Array.from(
          screenRef.current?.querySelectorAll<HTMLElement>('[data-shatter-root]') ?? [],
        );

        if (!screenRef.current) {
          resolve();
          return;
        }

        animate(textTargets, {
          opacity: [1, 0],
          y: [0, -MOTION_OFFSET.title],
          scale: [1, 0.92],
          duration: MOTION_DURATION.slow,
          ease: MOTION_EASE.exit,
          autoplay: true,
        });

        animate(rootTargets, {
          opacity: [1, 0],
          scale: [1, 0.96],
          duration: MOTION_DURATION.slow,
          ease: MOTION_EASE.exit,
          autoplay: true,
        });

        if (backgroundRef.current) {
          animate(backgroundRef.current, {
            opacity: [1, 0],
            scale: [1, 1.08],
            duration: MOTION_DURATION.slow,
            ease: MOTION_EASE.exit,
            autoplay: true,
          });
        }

        window.setTimeout(resolve, 900);
      });

    const run = async () => {
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, MOTION_DURATION.redirectDelay),
      );

      if (isCancelled) return;
      if (hasNavigatedRef.current) return;

      setStatusText('Signing out...');
      const supabase = createClient();
      await supabase.auth.signOut();

      if (isCancelled) return;
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;

      setStatusText('See you next time.');
      await playFadeOutExit();
      router.replace('/login');
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main ref={screenRef} className='relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030303] px-4 text-white'>
      <div data-shatter-root className='pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#030303_0%,#18181b_48%,#f8fafc_165%)]' />
      <div
        ref={backgroundRef}
        data-shatter-root
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_82%_78%,rgba(148,163,184,0.16),transparent_38%)]'
      />
      <div data-shatter-root className='relative w-full max-w-2xl overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br from-white/[0.14] via-white/[0.06] to-black/30 p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-12'>
        <p
          data-goodbye-content
          className='text-xs font-medium uppercase tracking-[0.16em] text-zinc-300'
        >
          Signed out
        </p>
        <h1
          ref={titleRef}
          data-goodbye-content
          className='mt-4 bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-4xl font-semibold tracking-[-0.04em] text-transparent sm:text-6xl'
        >
          {'Goodbye'.split('').map((char, index) => (
            <span key={`${char}-${index}`} data-char className='inline-block'>
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        <p
          ref={nameRef}
          data-goodbye-content
          className='mt-6 text-base text-zinc-200 sm:text-lg'
        >
          {displayName ? `See you later, ${displayName}` : 'Loading profile...'}
        </p>
        <p
          ref={statusRef}
          data-goodbye-content
          className='mt-4 text-sm text-zinc-400'
        >
          {statusText}
        </p>
      </div>
    </main>
  );
}
