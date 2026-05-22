"use client"

import { animate, stagger } from "animejs"
import { useEffect, useRef } from "react"
import { MOTION_DURATION, MOTION_EASE, MOTION_STAGGER } from "@/lib/animation/constants"

type LoadingStateProps = {
  label?: string
  rows?: number
}

export function LoadingState({ label = "Loading...", rows = 3 }: LoadingStateProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const targets = Array.from(container.querySelectorAll<HTMLElement>("[data-loading-row]"))
    if (!targets.length) {
      return
    }

    const animation = animate(targets, {
      opacity: [0.4, 1, 0.4],
      duration: MOTION_DURATION.loadingLoop,
      delay: stagger(MOTION_STAGGER.relaxed, { from: "first" }),
      loop: true,
      ease: MOTION_EASE.smooth,
      autoplay: true,
    })

    return () => {
      animation.pause()
    }
  }, [rows])

  return (
    <div ref={containerRef} aria-live="polite" aria-busy="true" className="space-y-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} data-loading-row className="h-16 rounded-md border border-border bg-muted/60" />
        ))}
      </div>
    </div>
  )
}
