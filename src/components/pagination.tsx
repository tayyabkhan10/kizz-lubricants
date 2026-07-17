import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Compact, professional pagination bar. Server-driven: the parent owns `page`
 * and refetches on `onPage`. Renders nothing when everything fits on one page.
 */
export function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number; // total matching row count
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-line">
      <p className="text-[12.5px] text-muted tabular-nums">
        Showing <span className="text-ink font-medium">{from.toLocaleString()}</span>–
        <span className="text-ink font-medium">{to.toLocaleString()}</span> of{" "}
        <span className="text-ink font-medium">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="btn-secondary btn-sm"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2.2} />
          Prev
        </button>
        <span className="text-[12.5px] text-muted tabular-nums px-1">
          {page} / {pageCount}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="btn-secondary btn-sm"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
