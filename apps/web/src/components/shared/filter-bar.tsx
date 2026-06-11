import * as React from "react"

type FilterBarProps = {
  children: React.ReactNode
}

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="app-filter-surface flex flex-wrap items-center gap-2 rounded-lg px-3 py-2">
      {children}
    </div>
  )
}
