import * as React from "react"

type PageHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
  meta?: React.ReactNode
}

export function PageHeader({ title, description, action, meta }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-page-title text-foreground">{title}</h1>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
        {meta ? <div className="text-caption text-muted-foreground">{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
