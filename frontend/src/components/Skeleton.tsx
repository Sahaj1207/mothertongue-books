/** Soft grey shapes of what's coming, while a book or list loads. Screen readers hear the label instead. */
export function BookSkeleton({ label }: { label: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10 lg:max-w-6xl" aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      <div aria-hidden="true" className="animate-pulse">
        <div className="h-4 w-16 rounded-full bg-rule/60" />
        <div className="mt-3 h-9 w-3/4 max-w-md rounded-xl bg-rule/60" />
        <div className="mt-6 overflow-hidden rounded-3xl border border-rule lg:grid lg:grid-cols-2">
          <div className="aspect-square w-full bg-rule/40" />
          <div className="space-y-4 p-6">
            <div className="h-6 w-11/12 rounded-lg bg-rule/50" />
            <div className="h-6 w-4/5 rounded-lg bg-rule/50" />
            <div className="h-6 w-2/3 rounded-lg bg-rule/50" />
          </div>
        </div>
      </div>
    </main>
  )
}

export function RowsSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div className="mt-8" aria-busy="true">
      <p className="sr-only" role="status">
        {label}
      </p>
      <ul aria-hidden="true" className="animate-pulse divide-y divide-rule overflow-hidden rounded-3xl border border-rule">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-4 p-5">
            <div className="h-12 w-2 rounded-full bg-rule/70" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-1/2 rounded-lg bg-rule/60" />
              <div className="h-3.5 w-1/3 rounded-lg bg-rule/40" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
