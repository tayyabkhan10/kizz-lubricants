/**
 * Segment-level loading UI. The App Router renders this the instant a nav link
 * is clicked — before the target ledger page mounts — so switching between
 * ledgers shows a structured skeleton instead of a blank flash. Pages that
 * already have warm localCache data paint over it near-instantly.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header block */}
      <div className="space-y-2">
        <div className="h-7 w-52 bg-black/[0.06] rounded" />
        <div className="h-3 w-72 bg-black/[0.04] rounded" />
      </div>

      {/* Controls row (search + total) */}
      <div className="flex items-center justify-between gap-4">
        <div className="h-10 w-full max-w-sm bg-black/[0.04] rounded-lg" />
        <div className="h-10 w-28 bg-black/[0.04] rounded-lg flex-shrink-0" />
      </div>

      {/* Table skeleton */}
      <div className="card overflow-hidden">
        <div className="h-11 bg-black/[0.03] border-b border-line" />
        <div className="divide-y divide-line">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <div className="h-4 bg-black/[0.04] rounded" style={{ width: `${90 - i * 6}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
