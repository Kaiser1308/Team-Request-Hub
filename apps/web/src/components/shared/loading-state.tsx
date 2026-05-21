type LoadingStateProps = {
  label?: string
  rows?: number
}

export function LoadingState({ label = "Loading...", rows = 3 }: LoadingStateProps) {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-md border border-border bg-muted/60" />
        ))}
      </div>
    </div>
  )
}
