

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sales, customerEntries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recalcBalances } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = Number(params.id);
    const [existing] = await db.select({ customerId: sales.customerId }).from(sales).where(eq(sales.id, id));

    // Deleting the sale cascades at the DB level to: its debit ledger row
    // (customer_entries.sale_id) and any payments (sale_payments.sale_id),
    // which in turn cascade to their own mirrored credit ledger rows. We
    // just need to recalc the running balances afterwards.
    await db.delete(sales).where(eq(sales.id, id));

    if (existing?.customerId) await recalcBalances(existing.customerId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete sale." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = await req.json();
    const update: Record<string, unknown> = {};
    if ("date" in b) update.date = b.date;
    if ("detail" in b) update.detail = b.detail;
    if ("product" in b) update.product = str(b.product);
    if ("packing" in b) update.packing = str(b.packing);
    if ("unit" in b) update.unit = str(b.unit);
    if ("qty" in b) update.qty = num(b.qty);
    if ("rate" in b) update.rate = num(b.rate);
    if ("amount" in b) {
      const n = Number(b.amount);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "amount must be a number." }, { status: 400 });
      update.amount = String(n);
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
    }

    const [row] = await db.update(sales).set(update).where(eq(sales.id, Number(params.id))).returning();

    // Automation: keep the mirrored debit ledger entry in step with the edited sale.
    // (Payments are tracked separately and are untouched by editing the sale itself.)
    if (row?.ledgerEntryId && row.customerId) {
      await db
        .update(customerEntries)
        .set({
          date: row.date,
          product: row.product ?? row.detail,
          packing: row.packing,
          unit: row.unit,
          qty: row.qty,
          rate: row.rate,
          debit: row.amount,
        })
        .where(eq(customerEntries.id, row.ledgerEntryId));
      await recalcBalances(row.customerId);
    }

    return NextResponse.json(row);
  } catch (err) {
    console.error("PATCH /sales/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update sale." }, { status: 500 });
  }
}