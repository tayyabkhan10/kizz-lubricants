

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { customerEntries, sales, salePayments } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { recalcBalances } from "@/lib/ledger";

export const dynamic = "force-dynamic";

/** Coerce an optional numeric field to the DB's string|null shape. */
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

function entriesFor(customerId: number) {
  return db
    .select()
    .from(customerEntries)
    .where(eq(customerEntries.customerId, customerId))
    .orderBy(asc(customerEntries.date), asc(customerEntries.id));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const customerId = Number(params.id);
    const entryId = Number(params.entryId);

    const [entry] = await db
      .select({ saleId: customerEntries.saleId, salePaymentId: customerEntries.salePaymentId })
      .from(customerEntries)
      .where(eq(customerEntries.id, entryId));

    // Two-way sync: deleting this row from the ledger removes its source
    // record on the Sales side too (which cascades back and removes this
    // very row, plus any siblings, automatically).
    if (entry?.saleId) {
      // This is a sale's debit mirror — remove the whole sale (and, via
      // cascade, any of its payments and their mirrored credit rows).
      await db.delete(sales).where(eq(sales.id, entry.saleId));
    } else if (entry?.salePaymentId) {
      // This is a payment mirror — remove that payment, which brings the
      // sale's outstanding balance back up.
      await db.delete(salePayments).where(eq(salePayments.id, entry.salePaymentId));
    } else {
      await db.delete(customerEntries).where(eq(customerEntries.id, entryId));
    }

    await recalcBalances(customerId);
    return NextResponse.json(await entriesFor(customerId));
  } catch (err) {
    console.error("DELETE /customers/[id]/entries/[entryId] failed:", err);
    return NextResponse.json({ error: "Failed to delete ledger entry." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const customerId = Number(params.id);
    const entryId = Number(params.entryId);
    const b = await req.json();

    if (!b.date) return NextResponse.json({ error: "date is required" }, { status: 400 });

    const [existing] = await db
      .select({ saleId: customerEntries.saleId, salePaymentId: customerEntries.salePaymentId })
      .from(customerEntries)
      .where(eq(customerEntries.id, entryId));

    // Whitelist editable columns only — never trust the raw body to set id,
    // customerId, balance or createdAt. balance is recomputed below regardless.
    await db
      .update(customerEntries)
      .set({
        date: b.date,
        product: b.product ?? null,
        packing: b.packing ?? null,
        unit: b.unit ?? null,
        qty: num(b.qty),
        rate: num(b.rate),
        debit: String(Number(b.debit ?? 0)),
        credit: String(Number(b.credit ?? 0)),
        account: b.account ?? null,
      })
      .where(eq(customerEntries.id, entryId));

    // Two-way sync: push the edit back to the source sale / payment so
    // both screens stay in step, whichever one you edit from.
    if (existing?.saleId) {
      await db
        .update(sales)
        .set({
          date: b.date,
          product: b.product ?? null,
          packing: b.packing ?? null,
          unit: b.unit ?? null,
          qty: num(b.qty),
          rate: num(b.rate),
          amount: String(Number(b.debit ?? 0)),
        })
        .where(eq(sales.id, existing.saleId));
    } else if (existing?.salePaymentId) {
      await db
        .update(salePayments)
        .set({
          date: b.date,
          amount: String(Number(b.credit ?? 0)),
        })
        .where(eq(salePayments.id, existing.salePaymentId));
    }

    await recalcBalances(customerId);
    return NextResponse.json(await entriesFor(customerId));
  } catch (err) {
    console.error("PATCH /customers/[id]/entries/[entryId] failed:", err);
    return NextResponse.json({ error: "Failed to update ledger entry." }, { status: 500 });
  }
}