import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sales, purchasing, expenses, salary, customers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { formatMoney, toNum } from "@/lib/utils";
import Link from "next/link";
import { TrendingUp, TrendingDown, Receipt, Wallet, Users, ArrowUpRight } from "lucide-react";
import { EmptyState } from "@/components/states";

async function getStats() {
  const [[{ totalSales }], [{ totalPurch }], [{ totalExp }], [{ totalSal }], [{ custCount }]] =
    await Promise.all([
      db.select({ totalSales: sql<string>`COALESCE(SUM(amount),0)` }).from(sales),
      db.select({ totalPurch: sql<string>`COALESCE(SUM(amount),0)` }).from(purchasing),
      db.select({ totalExp: sql<string>`COALESCE(SUM(amount),0)` }).from(expenses),
      db.select({ totalSal: sql<string>`COALESCE(SUM(amount),0)` }).from(salary),
      db.select({ custCount: sql<string>`COUNT(*)` }).from(customers),
    ]);

  const latestBal = await db.execute(sql`
    SELECT COALESCE(SUM(latest_bal), 0) AS total_outstanding
    FROM (
      SELECT DISTINCT ON (customer_id) balance AS latest_bal
      FROM customer_entries
      ORDER BY customer_id, date DESC, id DESC
    ) sub
  `);

  const outstanding = toNum((latestBal.rows[0] as Record<string, string>).total_outstanding);
  const s = toNum(totalSales), p = toNum(totalPurch), e = toNum(totalExp), sal = toNum(totalSal);
  const profit = s - (p + e + sal);
  const margin = s > 0 ? (profit / s) * 100 : 0;
  return { totalSales: s, totalPurchasing: p, totalExpenses: e, totalSalary: sal, profit, margin, outstanding, custCount: Number(custCount) };
}

async function getTopCustomerBalances() {
  const rows = await db.execute(sql`
    SELECT c.id, c.name, c.address, c.phone,
      (SELECT balance FROM customer_entries ce WHERE ce.customer_id = c.id ORDER BY date DESC, id DESC LIMIT 1) AS balance
    FROM customers c
    ORDER BY ABS(COALESCE((SELECT balance FROM customer_entries ce WHERE ce.customer_id = c.id ORDER BY date DESC, id DESC LIMIT 1),0)) DESC NULLS LAST
    LIMIT 10
  `);
  return rows.rows as { id: number; name: string; address: string; phone: string; balance: string }[];
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const [stats, customerBalances] = await Promise.all([getStats(), getTopCustomerBalances()]);
  const isProfit = stats.profit >= 0;

  const statCards = [
    { label: "Sales", value: formatMoney(stats.totalSales), icon: TrendingUp },
    { label: "Purchasing", value: formatMoney(stats.totalPurchasing), icon: TrendingDown },
    { label: "Expenses", value: formatMoney(stats.totalExpenses), icon: Receipt },
    { label: "Salary paid", value: formatMoney(stats.totalSalary), icon: Wallet },
  ];

  return (
    <div className="space-y-5 pb-10">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="rise">
        <p className="eyebrow">Dashboard</p>
        <h1 className="mt-1.5 text-[26px] font-semibold text-ink">Overview</h1>
        <p className="mt-1 text-sm text-muted">
          Live totals across every ledger — sales, purchasing, expenses and salary.
        </p>
      </div>

      {/* ── Hero: Net profit / loss (violet-tinted focal point) ── */}
      <div className="rise rise-1 relative overflow-hidden rounded-2xl bg-accent-tint border border-accent/15 shadow-card">
        {/* accent spine — the one saturated stroke */}
        <div className="absolute inset-y-0 left-0 w-1 bg-accent" />

        <div className="relative p-6 sm:p-8 pl-7 sm:pl-9">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-eyebrow text-accent-ink/70">
              {isProfit ? "Net profit" : "Net loss"} · all time
            </span>
            <span
              className={`badge ${isProfit ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}
            >
              {isProfit ? "▲" : "▼"} {stats.margin.toFixed(1)}%
            </span>
          </div>
          <p
            className={`mt-3 font-mono font-semibold leading-none tabular-nums text-[clamp(2.25rem,7vw,3.5rem)] ${
              isProfit ? "text-ink" : "text-danger"
            }`}
          >
            {formatMoney(Math.abs(stats.profit))}
          </p>
          <p className="mt-3 text-[13px] text-muted">
            Sales <span className="text-ink font-medium">{formatMoney(stats.totalSales)}</span> less
            cost of {formatMoney(stats.totalPurchasing + stats.totalExpenses + stats.totalSalary)}
          </p>

          {/* Secondary metrics — full-width row, room to breathe */}
          <div className="mt-7 grid grid-cols-2 gap-4 pt-6 border-t border-accent/15">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-accent-ink/70 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" strokeWidth={2} /> Customers
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold text-ink tabular-nums">
                {stats.custCount}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-accent-ink/70">
                Outstanding
              </p>
              <p
                className={`mt-2 font-mono text-2xl font-semibold tabular-nums whitespace-nowrap ${
                  stats.outstanding > 0 ? "text-warning" : "text-ink"
                }`}
              >
                {formatMoney(stats.outstanding)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat grid (secondary) ──────────────────────────── */}
      <div className="rise rise-2 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((c) => (
          <div key={c.label} className="card-interactive p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-accent-tint text-accent-ink">
                <c.icon className="w-3.5 h-3.5" strokeWidth={2.2} />
              </span>
              <p className="eyebrow">{c.label}</p>
            </div>
            <p className="mt-3 font-mono text-xl sm:text-[26px] leading-none font-semibold text-ink tabular-nums whitespace-nowrap">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Customer balances ──────────────────────────────── */}
      <div className="rise rise-3 card overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <p className="eyebrow">Accounts</p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-ink">Customer balances</h2>
          </div>
          <Link
            href="/dashboard/customers"
            className="inline-flex items-center gap-1 text-[13px] text-accent-ink hover:text-accent-hover font-medium transition-colors"
          >
            View all <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-black/[0.015] border-b border-line">
                <th className="th">Customer</th>
                <th className="th">Address</th>
                <th className="th">Phone</th>
                <th className="th text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customerBalances.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={Users}
                      compact
                      title="No customers yet"
                      description="Add your first customer to start tracking balances."
                      action={<Link href="/dashboard/customers" className="btn-primary">+ Add Customer</Link>}
                    />
                  </td>
                </tr>
              ) : (
                customerBalances.map((c) => {
                  const bal = toNum(c.balance);
                  return (
                    <tr key={c.id} className="hover:bg-black/[0.015] transition-colors">
                      <td className="td py-3.5">
                        <Link
                          href={`/dashboard/customers/${c.id}`}
                          className="font-medium text-ink hover:text-accent transition-colors"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="td py-3.5 text-muted text-xs">{c.address || "—"}</td>
                      <td className="td py-3.5 text-muted text-xs font-mono">{c.phone || "—"}</td>
                      <td
                        className={`td py-3.5 text-right font-mono font-semibold text-[13px] tabular-nums ${
                          bal > 0 ? "text-warning" : bal < 0 ? "text-success" : "text-muted"
                        }`}
                      >
                        {formatMoney(bal)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden divide-y divide-line">
          {customerBalances.length === 0 ? (
            <EmptyState
              icon={Users}
              compact
              title="No customers yet"
              description="Add your first customer to start tracking balances."
              action={<Link href="/dashboard/customers" className="btn-primary">+ Add Customer</Link>}
            />
          ) : (
            customerBalances.map((c) => {
              const bal = toNum(c.balance);
              return (
                <Link
                  key={c.id}
                  href={`/dashboard/customers/${c.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3.5 active:bg-black/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink text-sm truncate">{c.name}</p>
                    <p className="text-muted text-[11px] mt-0.5 truncate">
                      {c.phone || c.address || "—"}
                    </p>
                  </div>
                  <p
                    className={`font-mono font-semibold text-sm tabular-nums flex-shrink-0 ${
                      bal > 0 ? "text-warning" : bal < 0 ? "text-success" : "text-muted"
                    }`}
                  >
                    {formatMoney(bal)}
                  </p>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
