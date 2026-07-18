

"use client";
import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatMoney, toNum, fmtDate } from "@/lib/utils";
import { createLocalCache } from "@/lib/localCache";
import { customerDetailCache } from "@/lib/customercache";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import { Pagination } from "@/components/pagination";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { SortHeader, type Sort, nextSort } from "@/components/sort-header";
import { SearchInput } from "@/components/search-input";
import { TrendingUp, History as HistoryIcon } from "lucide-react";

type SaleRow = {
  id: number;
  date: string;
  detail: string;
  product: string | null;
  packing: string | null;
  unit: string | null;
  qty: string | null;
  rate: string | null;
  amount: string;
  paid: string;
  balance: string;
  customerId: number | null;
  customerName: string | null;
};
type SalePaymentRow = { id: number; saleId: number; date: string; amount: string };
type SalesData = { rows: SaleRow[]; total: number; count: number };
type CustomerOption = { id: number; name: string };

const PAGE_SIZE = 50;
const TABLE_COLS = 12; // Date, Detail, Product, Packing, Unit, Customer, Qty, Rate, Amount, Paid, Balance, actions
const salesCache = createLocalCache<SalesData>("sales", { ttlMs: 5 * 60_000 });
const keyFor = (q: string, s: Sort, p: number) => `${q}|${s.col}|${s.dir}|p${p}`;

export default function SalesPage() {
  const initSort: Sort = { col: "date", dir: "desc" };
  const cached0 = salesCache.get(keyFor("", initSort, 1));
  const [rows, setRows] = useState<SaleRow[]>(cached0?.rows ?? []);
  const [total, setTotal] = useState(cached0?.total ?? 0);
  const [count, setCount] = useState(cached0?.count ?? 0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<Sort>(initSort);
  const [loading, setLoading] = useState(!cached0);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    detail: "", product: "", packing: "", unit: "",
    qty: "", rate: "", amount: "", credit: "", customerId: "",
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    date: "", detail: "", product: "", packing: "", unit: "", qty: "", rate: "", amount: "",
  });
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  // ── Payment recording + history ─────────────────────────
  const [payId, setPayId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: "" });
  const [paySaving, setPaySaving] = useState(false);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [payments, setPayments] = useState<Record<number, SalePaymentRow[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async (q: string, p: number, s: Sort, opts?: { silent?: boolean }) => {
    if (!opts?.silent) { setLoading(true); setError(false); }
    try {
      const data = await api.get<SalesData>(`/sales?search=${encodeURIComponent(q)}&page=${p}&limit=${PAGE_SIZE}&sort=${s.col}&dir=${s.dir}`);
      salesCache.set(keyFor(q, s, p), data);
      setRows(data.rows); setTotal(data.total); setCount(data.count);
    } catch {
      if (!opts?.silent) setError(true);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("search")?.trim() ?? "";
    if (initial) { setSearch(initial); setPage(1); load(initial, 1, initSort); return; }
    const cached = salesCache.get(keyFor("", initSort, 1));
    if (cached) {
      setRows(cached.rows); setTotal(cached.total); setCount(cached.count);
      setLoading(false);
      load("", 1, initSort, { silent: true });
    } else {
      load("", 1, initSort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Customer options for the "sell to" picker.
  useEffect(() => {
    api.get<CustomerOption[]>("/customers/options").then(setCustomers).catch(() => {});
  }, []);

  const applyView = (q: string, p: number, s: Sort) => {
    const cached = salesCache.get(keyFor(q, s, p));
    if (cached) { setRows(cached.rows); setTotal(cached.total); setCount(cached.count); }
    load(q, p, s);
  };

  const handleSearch = (v: string) => {
    setSearch(v); setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyView(v, 1, sort), 300);
  };
  const onSort = (col: string) => { const s = nextSort(sort, col); setSort(s); setPage(1); applyView(search, 1, s); };
  const goPage = (p: number) => { setPage(p); applyView(search, p, sort); };

  const handleAutoAmount = () => {
    const q = Number(form.qty), r = Number(form.rate);
    if (q > 0 && r > 0) setForm(f => ({ ...f, amount: String(q * r) }));
  };

  const refreshAfterMoneyChange = (customerId: number | null) => {
    if (customerId) customerDetailCache.delete(String(customerId));
    salesCache.clear();
    load(search, page, sort, { silent: true });
  };

  const handleSave = async () => {
    if (!form.date || !form.detail || !form.amount) return;
    setSaving(true);
    try {
      await api.post<SaleRow>("/sales", {
        date: form.date,
        detail: form.detail,
        product: form.product || null,
        packing: form.packing || null,
        unit: form.unit || null,
        qty: form.qty ? Number(form.qty) : null,
        rate: form.rate ? Number(form.rate) : null,
        amount: Number(form.amount),
        credit: form.credit ? Number(form.credit) : 0,
        customerId: form.customerId ? Number(form.customerId) : null,
      });
      // The linked customer's ledger just changed — drop its cached detail.
      if (form.customerId) customerDetailCache.delete(form.customerId);
      setForm({
        date: new Date().toISOString().slice(0, 10),
        detail: "", product: "", packing: "", unit: "",
        qty: "", rate: "", amount: "", credit: "", customerId: "",
      });
      setShowForm(false);
      salesCache.clear();
      setPage(1);
      load(search, 1, sort);
      toast.success(form.customerId ? "Sale added & posted to ledger" : "Sale added");
    } catch { toast.error("Couldn't add sale"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const del = rows.find(r => r.id === id);
    const linked = del?.customerId ? " Its ledger entry and any recorded payments will be removed too." : "";
    if (!(await confirm({ title: "Delete this sale?", message: `This can't be undone.${linked}`, confirmText: "Delete", danger: true }))) return;
    const prevRows = rows, prevTotal = total, prevCount = count;
    setRows(r => r.filter(row => row.id !== id));
    if (del) setTotal(t => t - toNum(del.amount));
    setCount(c => Math.max(0, c - 1));
    try {
      await api.del(`/sales/${id}`);
      if (del?.customerId) customerDetailCache.delete(String(del.customerId));
      salesCache.clear();
      load(search, page, sort, { silent: true });
      toast.success("Sale deleted");
    } catch { setRows(prevRows); setTotal(prevTotal); setCount(prevCount); toast.error("Couldn't delete sale"); }
  };

  const startEdit = (r: SaleRow) => {
    setEditId(r.id);
    setEditForm({
      date: r.date.slice(0, 10),
      detail: r.detail,
      product: r.product ?? "",
      packing: r.packing ?? "",
      unit: r.unit ?? "",
      qty: r.qty ? String(r.qty) : "",
      rate: r.rate ? String(r.rate) : "",
      amount: r.amount,
    });
  };

  const handleEditAutoAmount = () => {
    const q = Number(editForm.qty), r = Number(editForm.rate);
    if (q > 0 && r > 0) setEditForm(f => ({ ...f, amount: String(q * r) }));
  };

  const saveEdit = async (id: number) => {
    if (!editForm.date || !editForm.detail || !editForm.amount) return;
    const prevRows = rows;
    const edited = rows.find(r => r.id === id);
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...editForm } as SaleRow : r));
    setEditId(null);
    try {
      await api.patch(`/sales/${id}`, {
        ...editForm,
        product: editForm.product || null,
        packing: editForm.packing || null,
        unit: editForm.unit || null,
        qty: editForm.qty ? Number(editForm.qty) : null,
        rate: editForm.rate ? Number(editForm.rate) : null,
        amount: Number(editForm.amount),
      });
      if (edited?.customerId) customerDetailCache.delete(String(edited.customerId));
      salesCache.clear();
      load(search, page, sort, { silent: true });
      toast.success("Sale updated");
    } catch { setRows(prevRows); toast.error("Couldn't update sale"); }
  };

  // ── Payment recording ───────────────────────────────────
  const startPay = (r: SaleRow) => {
    setPayId(r.id);
    setHistoryId(null);
    setPayForm({ date: new Date().toISOString().slice(0, 10), amount: "" });
  };
  const cancelPay = () => setPayId(null);

  const submitPayment = async (r: SaleRow) => {
    const amt = Number(payForm.amount);
    if (!payForm.date || !(amt > 0)) return;
    setPaySaving(true);
    try {
      await api.post(`/sales/${r.id}/payments`, { date: payForm.date, amount: amt });
      refreshAfterMoneyChange(r.customerId);
      setPayments(p => { const next = { ...p }; delete next[r.id]; return next; }); // stale, refetch on next open
      setPayId(null);
      toast.success("Payment recorded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record payment");
    } finally {
      setPaySaving(false);
    }
  };

  // ── Payment history ─────────────────────────────────────
  const toggleHistory = async (r: SaleRow) => {
    if (historyId === r.id) { setHistoryId(null); return; }
    setPayId(null);
    setHistoryId(r.id);
    if (!payments[r.id]) {
      setHistoryLoading(true);
      try {
        const list = await api.get<SalePaymentRow[]>(`/sales/${r.id}/payments`);
        setPayments(p => ({ ...p, [r.id]: list }));
      } catch {
        toast.error("Couldn't load payment history");
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const deletePayment = async (r: SaleRow, paymentId: number) => {
    if (!(await confirm({ title: "Delete this payment?", message: "The sale's balance will go back up by this amount.", confirmText: "Delete", danger: true }))) return;
    try {
      await api.del(`/sales/${r.id}/payments/${paymentId}`);
      setPayments(p => ({ ...p, [r.id]: (p[r.id] ?? []).filter(x => x.id !== paymentId) }));
      refreshAfterMoneyChange(r.customerId);
      toast.success("Payment deleted");
    } catch { toast.error("Couldn't delete payment"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] font-semibold text-ink">Sales</h1>
            {count > 0 && <span className="badge-neutral tabular-nums">{count.toLocaleString()}</span>}
          </div>
          <p className="mt-1 text-sm text-muted">Every sale made from the factory — your money coming in.</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary">+ Add Sale</button>
      </div>

      {showForm && (
        <div className="card p-6">
          <h3 className="font-semibold text-ink mb-4">New Sale</h3>

          {/* Customer link — the automation: pick one and it posts to their ledger too */}
          <div className="mb-4">
            <label className="label">Customer</label>
            <select
              value={form.customerId}
              onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
              className="select py-2.5 text-sm max-w-xs"
            >
              <option value="">— Walk-in / cash sale —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted mt-1.5">
              Pick a customer and this sale is auto-posted to their ledger as a debit — no double entry.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { key: "date", label: "Date", type: "date" },
              { key: "detail", label: "Detail *", type: "text" },
              { key: "product", label: "Product", type: "text" },
              { key: "packing", label: "Packing", type: "text" },
              { key: "unit", label: "Unit", type: "text" },
              { key: "qty", label: "Qty", type: "number" },
              { key: "rate", label: "Rate (Rs)", type: "number" },
              { key: "amount", label: "Amount (Rs) *", type: "number" },
              { key: "credit", label: "Received now (Rs)", type: "number" },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type={type} value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  onBlur={key === "rate" || key === "qty" ? handleAutoAmount : undefined}
                  className="input py-2.5 text-sm" />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            Tip: Enter Qty + Rate — Amount auto-calculates on blur. If the customer paid something on the spot, put it in “Received now” — the rest stays as their balance.
          </p>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving || !form.detail || !form.amount} className="btn-primary">{saving ? "Saving…" : "Save Sale"}</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <SearchInput value={search} onChange={handleSearch} placeholder="Search sales…" className="w-full max-w-sm" />
        <div className="text-right flex-shrink-0">
          <p className="text-[11px] text-muted uppercase tracking-wider">Total</p>
          <p className="font-mono font-semibold text-ink tabular-nums">{formatMoney(total)}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead>
              <tr className="bg-black/[0.02] border-b border-line">
                <SortHeader col="date" label="Date" sort={sort} onSort={onSort} />
                <th className="th">Detail</th>
                <th className="th">Product</th>
                <th className="th">Packing</th>
                <th className="th">Unit</th>
                <th className="th">Customer</th>
                <th className="th">Qty</th>
                <th className="th text-right">Rate</th>
                <SortHeader col="amount" label="Amount" sort={sort} onSort={onSort} align="right" />
                <th className="th text-right">Paid</th>
                <th className="th text-right">Balance</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <TableSkeleton rows={6} cols={TABLE_COLS} />
              ) : error ? (
                <tr><td colSpan={TABLE_COLS}><ErrorState onRetry={() => load(search, page, sort)} compact /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={TABLE_COLS}><EmptyState icon={TrendingUp} compact title={search ? "No matches" : "No sales yet"} description={search ? `Nothing matches “${search}”.` : "Record your first sale with the “Add Sale” button."} /></td></tr>
              ) : rows.map(r => (
                <Fragment key={r.id}>
                  {editId === r.id ? (
                    <tr className="bg-accent-tint/40">
                      <td className="px-4 py-2">
                        <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="input px-2 py-1.5 text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editForm.detail} onChange={e => setEditForm(f => ({ ...f, detail: e.target.value }))} className="input px-2 py-1.5 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editForm.product} onChange={e => setEditForm(f => ({ ...f, product: e.target.value }))} className="input px-2 py-1.5 text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editForm.packing} onChange={e => setEditForm(f => ({ ...f, packing: e.target.value }))} className="input px-2 py-1.5 text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} className="input px-2 py-1.5 text-xs" />
                      </td>
                      <td className="px-4 py-2 text-muted text-xs whitespace-nowrap">{r.customerName ?? "Cash"}</td>
                      <td className="px-4 py-2">
                        <input type="number" value={editForm.qty} onChange={e => setEditForm(f => ({ ...f, qty: e.target.value }))} onBlur={handleEditAutoAmount} className="input px-2 py-1.5 text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={editForm.rate} onChange={e => setEditForm(f => ({ ...f, rate: e.target.value }))} onBlur={handleEditAutoAmount} className="input px-2 py-1.5 text-xs text-right font-mono" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="input px-2 py-1.5 text-sm text-right font-mono" />
                      </td>
                      <td className="px-4 py-2 text-right text-muted text-xs">—</td>
                      <td className="px-4 py-2 text-right text-muted text-xs">—</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-4">
                          <button onClick={() => saveEdit(r.id)} className="text-success font-semibold">✓</button>
                          <button onClick={() => setEditId(null)} className="text-muted">×</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr className="hover:bg-black/[0.015] transition-colors">
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-ink">{r.detail}</td>
                      <td className="px-4 py-3 text-ink text-xs">{r.product || <span className="text-muted/40">—</span>}</td>
                      <td className="px-4 py-3 text-muted text-xs">{r.packing || "—"}</td>
                      <td className="px-4 py-3 text-muted text-xs">{r.unit || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.customerId && r.customerName ? (
                          <Link href={`/dashboard/customers/${r.customerId}`} className="text-[13px] text-accent-ink hover:text-accent-hover font-medium transition-colors">
                            {r.customerName}
                          </Link>
                        ) : (
                          <span className="text-muted text-xs">Cash</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs">{r.qty ? Number(r.qty).toLocaleString() : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted text-xs tabular-nums">{r.rate ? formatMoney(r.rate) : "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-ink tabular-nums">{formatMoney(r.amount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-success text-xs tabular-nums">{toNum(r.paid) > 0 ? formatMoney(r.paid) : <span className="text-muted/30">—</span>}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold text-xs tabular-nums ${toNum(r.balance) > 0 ? "text-warning" : "text-success"}`}>
                        {formatMoney(r.balance)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {r.customerId && toNum(r.balance) > 0 && (
                            <button onClick={() => startPay(r)} className="text-[11px] font-semibold text-accent-ink hover:text-accent-hover" title="Record a payment">+ Payment</button>
                          )}
                          {r.customerId && (
                            <button onClick={() => toggleHistory(r)} className="text-muted/50 hover:text-accent transition-colors" title="Payment history">
                              <HistoryIcon className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                          )}
                          <button onClick={() => startEdit(r)} className="text-muted/50 hover:text-accent transition-colors" title="Edit sale">✎</button>
                          <button onClick={() => handleDelete(r.id)} className="text-muted/50 hover:text-danger transition-colors text-lg leading-none" title="Delete sale">×</button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {payId === r.id && (
                    <tr className="bg-warning/5">
                      <td colSpan={TABLE_COLS} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="label">Payment Date</label>
                            <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} className="input px-2 py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="label">Amount Received (Rs)</label>
                            <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} className="input px-2 py-1.5 text-sm" autoFocus />
                          </div>
                          <button onClick={() => submitPayment(r)} disabled={paySaving || !(Number(payForm.amount) > 0)} className="btn-primary">{paySaving ? "Saving…" : "Record Payment"}</button>
                          <button onClick={cancelPay} className="btn-secondary">Cancel</button>
                          <span className="text-xs text-muted ml-auto">Balance due: <b className="text-warning">{formatMoney(r.balance)}</b></span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {historyId === r.id && (
                    <tr className="bg-black/[0.01]">
                      <td colSpan={TABLE_COLS} className="px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">Payment history</p>
                        {historyLoading ? (
                          <p className="text-xs text-muted">Loading…</p>
                        ) : (payments[r.id]?.length ?? 0) === 0 ? (
                          <p className="text-xs text-muted">No payments recorded yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {payments[r.id].map(p => (
                              <div key={p.id} className="flex items-center justify-between text-xs bg-white/60 rounded-lg px-3 py-1.5 border border-line">
                                <span className="text-muted">{fmtDate(p.date)}</span>
                                <span className="font-mono font-semibold text-success">{formatMoney(p.amount)}</span>
                                <button onClick={() => deletePayment(r, p.id)} className="text-muted/50 hover:text-danger transition-colors text-base leading-none" title="Delete this payment">×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-line bg-black/[0.02]">
                  <td colSpan={8} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {search ? "Total (filtered)" : "Total Sales"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-ink tabular-nums">{formatMoney(total)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-success tabular-nums">
                    {formatMoney(rows.reduce((a, r) => a + toNum(r.paid), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-warning tabular-nums">
                    {formatMoney(rows.reduce((a, r) => a + toNum(r.balance), 0))}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!loading && !error && <Pagination page={page} total={count} pageSize={PAGE_SIZE} onPage={goPage} />}
      </div>
    </div>
  );
}