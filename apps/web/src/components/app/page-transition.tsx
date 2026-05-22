"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MOTION_DURATION, MOTION_EASE, MOTION_OFFSET } from "@/lib/animation/constants";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) {
      return;
    }

    const animation = animate(target, {
      y: [MOTION_OFFSET.small, 0],
      opacity: [0, 1],
      duration: MOTION_DURATION.page,
      ease: MOTION_EASE.entrance,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, [pathname]);

  return (
    <div ref={containerRef} key={pathname} className="page-transition">
      {children}
    </div>
  );
}
