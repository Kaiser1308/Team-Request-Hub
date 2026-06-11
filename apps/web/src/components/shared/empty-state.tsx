"use client"

import { animate } from "animejs"
import * as React from "react"
import { MOTION_DURATION, MOTION_EASE, MOTION_OFFSET } from "@/lib/animation/constants"

type EmptyStateProps = {
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const cardRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const target = cardRef.current
    if (!target) {
      return
    }

    const animation = animate(target, {
      y: [MOTION_OFFSET.small, 0],
      opacity: [0, 1],
      duration: MOTION_DURATION.page,
      ease: MOTION_EASE.entrance,
      autoplay: true,
    })

    return () => {
      animation.pause()
    }
  }, [])

  return (
    <div ref={cardRef} className="app-surface rounded-lg px-4 py-6 text-center sm:px-6">
      <h2 className="text-section-title text-[#111827]">{title}</h2>
      {description ? <p className="mx-auto mt-1 max-w-xl text-body text-[#615d59]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
