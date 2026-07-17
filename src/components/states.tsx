import type { LucideIcon } from "lucide-react";
import { Inbox, AlertTriangle } from "lucide-react";

/**
 * Shared empty / error / loading primitives so every list page presents the
 * same professional states instead of bare text.
 */

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-6 py-10" : "px-6 py-16"}`}>
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent-tint text-accent-ink">
        <Icon className="w-5 h-5" strokeWidth={2} />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-muted max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong while loading this data.",
  onRetry,
  compact = false,
}: {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-6 py-10" : "px-6 py-16"}`}>
      <span className="grid place-items-center w-11 h-11 rounded-xl bg-danger-tint text-danger">
        <AlertTriangle className="w-5 h-5" strokeWidth={2} />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-ink">Couldn&apos;t load</p>
      <p className="mt-1 text-sm text-muted max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm mt-5">
          Try again
        </button>
      )}
    </div>
  );
}

/** Shimmer rows sized to a table. Render inside a <tbody>. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <div
                className="h-3.5 rounded bg-black/[0.05] animate-pulse"
                style={{ width: `${c === 0 ? 70 : 40 + ((r + c) % 4) * 12}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Shimmer cards for the customers grid. */
export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-black/[0.05] animate-pulse" />
            <div className="w-14 h-5 rounded-full bg-black/[0.04] animate-pulse" />
          </div>
          <div className="mt-4 h-4 w-2/3 rounded bg-black/[0.05] animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-black/[0.04] animate-pulse" />
          <div className="mt-4 pt-4 border-t border-line h-6 w-1/3 rounded bg-black/[0.05] animate-pulse" />
        </div>
      ))}
    </div>
  );
}
