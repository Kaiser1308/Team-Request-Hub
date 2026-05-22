'use client';

import { animate, stagger } from 'animejs';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  MOTION_DELAY,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_STAGGER,
} from '@/lib/animation/constants';
import { getDashboardSummary } from '@/lib/api/dashboard';
import { queryKeys } from '@/lib/api/query-keys';
import { getCurrentUser } from '@/lib/api/users';
import { createClient } from '@/lib/supabase/client';

export function WelcomeScreen({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [statusText, setStatusText] = useState('Booting workspace...');
  const [isDisabledAccount, setIsDisabledAccount] = useState(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const nameRef = useRef<HTMLParagraphElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const hasNavigatedRef = useRef(false);

  const shards = [
    'polygon(0 0, 21% 0, 12% 18%, 0 16%)',
    'polygon(21% 0, 39% 0, 34% 20%, 12% 18%)',
    'polygon(39% 0, 61% 0, 55% 19%, 34% 20%)',
    'polygon(61% 0, 81% 0, 74% 21%, 55% 19%)',
    'polygon(81% 0, 100% 0, 100% 17%, 74% 21%)',
    'polygon(0 16%, 12% 18%, 14% 41%, 0 39%)',
    'polygon(12% 18%, 34% 20%, 31% 42%, 14% 41%)',
    'polygon(34% 20%, 55% 19%, 53% 43%, 31% 42%)',
    'polygon(55% 19%, 74% 21%, 72% 45%, 53% 43%)',
    'polygon(74% 21%, 100% 17%, 100% 44%, 72% 45%)',
    'polygon(0 39%, 14% 41%, 16% 67%, 0 64%)',
    'polygon(14% 41%, 31% 42%, 29% 66%, 16% 67%)',
    'polygon(31% 42%, 53% 43%, 51% 68%, 29% 66%)',
    'polygon(53% 43%, 72% 45%, 70% 69%, 51% 68%)',
    'polygon(72% 45%, 100% 44%, 100% 70%, 70% 69%)',
    'polygon(0 64%, 16% 67%, 18% 100%, 0 100%)',
    'polygon(16% 67%, 29% 66%, 34% 100%, 18% 100%)',
    'polygon(29% 66%, 51% 68%, 54% 100%, 34% 100%)',
    'polygon(51% 68%, 70% 69%, 74% 100%, 54% 100%)',
    'polygon(70% 69%, 100% 70%, 100% 100%, 74% 100%)',
  ];

  useEffect(() => {
    const supabase = createClient();

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      try {
        const currentUser = await getCurrentUser();
        if (currentUser.is_active === false) {
          setIsDisabledAccount(true);
          setDisplayName(currentUser.name ?? currentUser.email ?? 'Unknown user');
          setStatusText('Access blocked by administrator policy.');
          return;
        }

        setDisplayName(
          currentUser.name ??
            currentUser.email?.split('@')[0] ??
            user?.email?.split('@')[0] ??
            'there',
        );
        return;
      } catch {
        // Fall back to Supabase profile metadata when backend profile is unavailable.
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
    if (!titleEl) {
      return;
    }
    if (isDisabledAccount) {
      return;
    }

    const chars = Array.from(titleEl.querySelectorAll<HTMLElement>('[data-char]'));
    if (!chars.length) {
      return;
    }

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
  }, [isDisabledAccount]);

  useEffect(() => {
    const nameEl = nameRef.current;
    if (!nameEl || !displayName) {
      return;
    }

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
  }, [displayName, isDisabledAccount]);

  useEffect(() => {
    const statusEl = statusRef.current;
    if (!statusEl) {
      return;
    }

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
      setStatusText('Syncing dashboard modules...');
    }, MOTION_DELAY.short);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    if (isDisabledAccount) {
      return;
    }

    const minDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MOTION_DURATION.redirectDelay);
    });

    const preload = (async () => {
      router.prefetch(nextPath);
      setStatusText('Hydrating dashboard data...');
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: queryKeys.currentUser,
          queryFn: getCurrentUser,
        }),
        queryClient.prefetchQuery({
          queryKey: queryKeys.dashboardSummary,
          queryFn: getDashboardSummary,
        }),
      ]);
      setStatusText('Syncing dashboard modules...');
      try {
        await fetch(nextPath, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
        // Ignore preload errors and let navigation continue after timeout.
      }
    })();

    const preloadTimeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MOTION_DURATION.preloadTimeout);
    });

    const playShatterExit = () =>
      new Promise<void>((resolve) => {
        const shardTargets = Array.from(
          screenRef.current?.querySelectorAll<HTMLElement>('[data-screen-shard]') ?? [],
        );
        const textTargets = Array.from(
          screenRef.current?.querySelectorAll<HTMLElement>('[data-welcome-content]') ?? [],
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
          y: [0, -MOTION_OFFSET.small],
          duration: MOTION_DURATION.dialogOut,
          ease: MOTION_EASE.exit,
          autoplay: true,
        });

        if (backgroundRef.current) {
          animate(backgroundRef.current, {
            opacity: [1, 0.35],
            scale: [1, 0.97],
            duration: MOTION_DURATION.medium,
            ease: MOTION_EASE.exit,
            autoplay: true,
          });
        }

        animate(rootTargets, {
          scale: [1, 0.985],
          filter: ['brightness(1)', 'brightness(0.88)'],
          duration: MOTION_DURATION.medium,
          ease: MOTION_EASE.exit,
          autoplay: true,
        });

        if (!shardTargets.length) {
          window.setTimeout(resolve, 900);
          return;
        }

        animate(shardTargets, {
          opacity: [0, 1, 0],
          x: (_target: unknown, index: number) => ((index % 5) - 2) * 95,
          y: (_target: unknown, index: number) =>
            (index < 10 ? -1 : 1) * (65 + (index % 4) * 18),
          rotateZ: (_target: unknown, index: number) =>
            (index % 2 === 0 ? -1 : 1) * (35 + index * 3),
          scale: [0.68, 1.1, 0.78],
          delay: stagger(45, { from: 'center' }),
          duration: 980,
          ease: MOTION_EASE.dramatic,
          autoplay: true,
          onComplete: () => resolve(),
        });
      });

    void Promise.all([minDelay, Promise.race([preload, preloadTimeout])]).then(async () => {
      if (isCancelled) {
        return;
      }
      if (hasNavigatedRef.current) {
        return;
      }
      hasNavigatedRef.current = true;

      setStatusText('Connection established. Redirecting...');
      await playShatterExit();
      router.replace(nextPath);
    });

    return () => {
      isCancelled = true;
    };
  }, [nextPath, router, isDisabledAccount, queryClient]);

  const title = isDisabledAccount ? 'ACCOUNT DISABLED' : 'WELCOME BACK!';

  return (
    <main ref={screenRef} className='relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020611] px-4'>
      <div data-shatter-root className='pointer-events-none absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(37,99,235,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.12)_1px,transparent_1px)] [background-size:32px_32px]' />
      <div
        ref={backgroundRef}
        data-shatter-root
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.22),transparent_45%),radial-gradient(circle_at_80%_75%,rgba(59,130,246,0.18),transparent_40%)]'
      />
      <div className='pointer-events-none absolute inset-0'>
        {shards.map((clipPath, index) => (
          <span
            key={`screen-shard-${index}`}
            data-screen-shard
            className='absolute inset-0 opacity-0'
            style={{
              clipPath,
              background:
                'linear-gradient(130deg, rgba(125,211,252,0.22), rgba(30,64,175,0.08))',
              mixBlendMode: 'screen',
            }}
          />
        ))}
      </div>
      <div ref={cardRef} data-shatter-root className='relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[#1d4ed8]/40 bg-gradient-to-br from-[#050b1c] via-[#0a1631] to-[#070f23] p-8 text-center shadow-[0_30px_100px_rgba(8,47,135,0.55)] sm:p-12'>
        <p
          data-welcome-content
          className='[font-family:var(--font-rajdhani)] text-xs uppercase tracking-[0.42em] text-[#60a5fa]'
        >
          {isDisabledAccount ? 'Security Lock' : 'Auth Handshake'}
        </p>
        <h1
          ref={titleRef}
          data-welcome-content
          className='[font-family:var(--font-orbitron)] mt-3 bg-gradient-to-r from-[#e2e8f0] via-[#7dd3fc] to-[#93c5fd] bg-clip-text text-3xl font-extrabold tracking-[0.24em] text-transparent sm:text-5xl'
        >
          {title.split('').map((char, index) => (
            <span key={`${char}-${index}`} data-char className='inline-block'>
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h1>
        <p
          ref={nameRef}
          data-welcome-content
          className='[font-family:var(--font-rajdhani)] mt-6 text-base text-[#bfdbfe] sm:text-lg'
        >
          {displayName
            ? isDisabledAccount
              ? `Account: ${displayName}`
              : `Hi, ${displayName}`
            : 'Loading profile...'}
        </p>
        <p
          ref={statusRef}
          data-welcome-content
          className='[font-family:var(--font-rajdhani)] mt-3 text-xs uppercase tracking-[0.24em] text-[#7dd3fc]'
        >
          {statusText}
        </p>
      </div>
    </main>
  );
}
