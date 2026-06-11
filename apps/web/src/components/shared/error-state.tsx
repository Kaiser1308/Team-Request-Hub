import * as React from "react"

type ErrorStateProps = {
  title?: string
  message: string
  action?: React.ReactNode
}

export function ErrorState({ title = "Unable to load data", message, action }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4">
      <h2 className="text-section-title text-red-950">{title}</h2>
      <p className="mt-1 text-body text-red-700">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
