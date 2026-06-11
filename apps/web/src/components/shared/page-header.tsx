import * as React from "react"

type PageHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
  meta?: React.ReactNode
}

export function PageHeader({ title, description, action, meta }: PageHeaderProps) {
  return (
    <header className="app-surface rounded-lg p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-page-title text-[#111827]">{title}</h1>
          {description ? <p className="max-w-3xl text-body text-[#615d59]">{description}</p> : null}
          {meta ? <div className="text-caption text-[#615d59]">{meta}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  )
}
