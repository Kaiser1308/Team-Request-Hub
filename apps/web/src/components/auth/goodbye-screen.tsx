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
  const [statusText, setStatusText] = useState('Clearing session...');
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
      setStatusText('Revoking access token...');
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

      setStatusText('Goodbye. See you next time.');
      await playFadeOutExit();
      router.replace('/login');
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  return (
    <main ref={screenRef} className='relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020611] px-4'>
      <div data-shatter-root className='pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(37,99,235,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.12)_1px,transparent_1px)] [background-size:32px_32px]' />
      <div
        ref={backgroundRef}
        data-shatter-root
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.22),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(59,130,246,0.18),transparent_40%)]'
      />
      <div data-shatter-root className='relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[#1d4ed8]/40 bg-gradient-to-br from-[#050b1c] via-[#0a1631] to-[#070f23] p-8 text-center shadow-[0_30px_100px_rgba(8,47,135,0.55)] sm:p-12'>
        <p
          data-goodbye-content
          className='[font-family:var(--font-rajdhani)] text-xs uppercase tracking-[0.42em] text-[#f87171]'
        >
          Session Termination
        </p>
        <h1
          ref={titleRef}
          data-goodbye-content
          className='[font-family:var(--font-orbitron)] mt-3 bg-gradient-to-r from-[#e2e8f0] via-[#fca5a5] to-[#f87171] bg-clip-text text-3xl font-extrabold tracking-[0.24em] text-transparent sm:text-5xl'
        >
          {'GOOD BYE!'.split('').map((char, index) => (
            <span key={`${char}-${index}`} data-char className='inline-block'>
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        <p
          ref={nameRef}
          data-goodbye-content
          className='[font-family:var(--font-rajdhani)] mt-6 text-base text-[#fecaca] sm:text-lg'
        >
          {displayName ? `See you later, ${displayName}` : 'Loading profile...'}
        </p>
        <p
          ref={statusRef}
          data-goodbye-content
          className='[font-family:var(--font-rajdhani)] mt-3 text-xs uppercase tracking-[0.24em] text-[#f87171]'
        >
          {statusText}
        </p>
      </div>
    </main>
  );
}
