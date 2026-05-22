export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="skeleton-pulse h-10 w-48 rounded-lg bg-[#e5e7eb]" />
      <div className="skeleton-pulse h-4 w-72 rounded bg-[#e5e7eb]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-pulse rounded-lg border border-[#e5e7eb] bg-white p-4"
          >
            <div className="skeleton-pulse mb-3 h-4 w-3/4 rounded bg-[#e5e7eb]" />
            <div className="skeleton-pulse mb-2 h-3 w-1/2 rounded bg-[#e5e7eb]" />
            <div className="skeleton-pulse h-3 w-1/3 rounded bg-[#e5e7eb]" />
          </div>
        ))}
      </div>
    </div>
  );
}
