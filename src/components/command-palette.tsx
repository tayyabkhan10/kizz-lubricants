"use client";

import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatMoney, fmtDate } from "@/lib/utils";
import { Search, Users, TrendingUp, TrendingDown, Receipt, Wallet, LayoutGrid, BarChart3, CornerDownLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
type SearchResults = {
  customers: { id: number; name: string; phone: string | null; address: string | null }[];
  sales: { id: number; date: string; detail: string; amount: string }[];
  purchasing: { id: number; date: string; detail: string; amount: string }[];
  expenses: { id: number; date: string; detail: string; amount: string }[];
  salary: { id: number; date: string; employee: string; amount: string }[];
};

type Item = { key: string; group: string; title: string; subtitle?: string; href: string; icon: LucideIcon };

// Static pages for instant "jump to" navigation (no network).
const PAGES: { title: string; href: string; keys: string; icon: LucideIcon }[] = [
  { title: "Overview", href: "/dashboard", keys: "overview dashboard home", icon: LayoutGrid },
  { title: "Customers", href: "/dashboard/customers", keys: "customers parties accounts ledger", icon: Users },
  { title: "Sales", href: "/dashboard/sales", keys: "sales income revenue", icon: TrendingUp },
  { title: "Purchasing", href: "/dashboard/purchasing", keys: "purchasing purchases stock oil drums chemicals", icon: TrendingDown },
  { title: "Expenses", href: "/dashboard/expenses", keys: "expenses costs petrol rent repairs", icon: Receipt },
  { title: "Salary", href: "/dashboard/salary", keys: "salary payroll wages staff employee", icon: Wallet },
  { title: "Profit & Loss", href: "/dashboard/pnl", keys: "profit loss pnl margin analysis", icon: BarChart3 },
];

// ── Context so any component (e.g. the sidebar) can open the palette ──
const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useSearchPalette = () => useContext(Ctx);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {isOpen && <Palette onClose={() => setIsOpen(false)} />}
    </Ctx.Provider>
  );
}

// ── The palette ─────────────────────────────────────────────────────
function buildItems(q: string, res: SearchResults | null): Item[] {
  const ql = q.trim().toLowerCase();
  const items: Item[] = [];

  // Pages — always available; filtered once the user types.
  for (const p of PAGES) {
    if (!ql || p.title.toLowerCase().includes(ql) || p.keys.includes(ql)) {
      items.push({ key: `page-${p.href}`, group: "Pages", title: p.title, href: p.href, icon: p.icon });
    }
  }

  if (res) {
    for (const c of res.customers)
      items.push({
        key: `cust-${c.id}`,
        group: "Customers",
        title: c.name,
        subtitle: c.phone || c.address || undefined,
        href: `/dashboard/customers/${c.id}`,
        icon: Users,
      });

    const money = (
      rows: { id: number; date: string; amount: string }[],
      label: string,
      titleOf: (r: { detail?: string; employee?: string }) => string,
      section: string,
      icon: LucideIcon,
    ) => {
      for (const r of rows as (typeof rows[number] & { detail?: string; employee?: string })[])
        items.push({
          key: `${section}-${r.id}`,
          group: label,
          title: titleOf(r),
          subtitle: `${fmtDate(r.date)} · ${formatMoney(r.amount)}`,
          href: `/dashboard/${section}?search=${encodeURIComponent(q.trim())}`,
          icon,
        });
    };
    money(res.sales, "Sales", (r) => r.detail ?? "", "sales", TrendingUp);
    money(res.purchasing, "Purchasing", (r) => r.detail ?? "", "purchasing", TrendingDown);
    money(res.expenses, "Expenses", (r) => r.detail ?? "", "expenses", Receipt);
    money(res.salary, "Salary", (r) => r.employee ?? "", "salary", Wallet);
  }

  return items;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced fetch
  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setRes(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const d = await api.get<SearchResults>(`/search?q=${encodeURIComponent(query)}`);
        setRes(d);
      } catch {
        setRes(null);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  const items = useMemo(() => buildItems(q, res), [q, res]);

  useEffect(() => {
    setActive(0);
  }, [q, res]);

  const go = useCallback(
    (item?: Item) => {
      if (!item) return;
      router.push(item.href);
      onClose();
    },
    [router, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
  };

  // Keep the active row scrolled into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // Group items for rendering while keeping a flat index for keyboard nav
  let idx = -1;
  const groups: { group: string; items: (Item & { flat: number })[] }[] = [];
  for (const it of items) {
    idx++;
    const last = groups[groups.length - 1];
    const withFlat = { ...it, flat: idx };
    if (last && last.group === it.group) last.items.push(withFlat);
    else groups.push({ group: it.group, items: [withFlat] });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="dialog-backdrop absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="dialog-in relative w-full max-w-[560px] overflow-hidden rounded-2xl bg-surface border border-line shadow-pop">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Search className="w-[18px] h-[18px] text-faint flex-shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search customers, sales, expenses…"
            className="flex-1 bg-transparent py-3.5 text-[15px] text-ink placeholder:text-faint focus:outline-none"
          />
          <kbd className="hidden sm:block text-[11px] font-medium text-faint border border-line-strong rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">
              {loading ? "Searching…" : q.trim() ? `No matches for “${q.trim()}”.` : "Type to search."}
            </div>
          ) : (
            groups.map((grp) => (
              <div key={grp.group} className="mb-1">
                <p className="px-4 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-eyebrow text-faint">{grp.group}</p>
                {grp.items.map((it) => (
                  <button
                    key={it.key}
                    data-idx={it.flat}
                    onClick={() => go(it)}
                    onMouseMove={() => setActive(it.flat)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active === it.flat ? "bg-accent-tint" : "hover:bg-black/[0.02]"
                    }`}
                  >
                    <span className={`grid place-items-center w-8 h-8 rounded-lg flex-shrink-0 ${active === it.flat ? "bg-accent text-white" : "bg-black/[0.04] text-muted"}`}>
                      <it.icon className="w-4 h-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-ink truncate">{it.title}</span>
                      {it.subtitle && <span className="block text-[12px] text-muted truncate">{it.subtitle}</span>}
                    </span>
                    {active === it.flat && <CornerDownLeft className="w-3.5 h-3.5 text-accent-ink flex-shrink-0" strokeWidth={2} />}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-line bg-black/[0.01] text-[11px] text-muted">
          <span className="flex items-center gap-1"><kbd className="border border-line-strong rounded px-1">↑</kbd><kbd className="border border-line-strong rounded px-1">↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="border border-line-strong rounded px-1">↵</kbd> open</span>
        </div>
      </div>
    </div>
  );
}
