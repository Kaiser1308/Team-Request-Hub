import * as React from "react"

type FilterBarProps = {
  children: React.ReactNode
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
      {children}
    </div>
  )
}
