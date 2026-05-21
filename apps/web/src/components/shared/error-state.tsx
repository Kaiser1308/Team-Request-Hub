import * as React from "react"

type ErrorStateProps = {
  title?: string
  message: string
  action?: React.ReactNode
}

export function ErrorState({ title = "Unable to load data", message, action }: ErrorStateProps) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-4">
      <h2 className="text-base font-semibold tracking-normal text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
