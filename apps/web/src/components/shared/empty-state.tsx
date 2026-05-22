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
    <div ref={cardRef} className="rounded-md border border-border bg-card px-4 py-6 text-center">
      <h2 className="text-base font-semibold tracking-normal text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}
