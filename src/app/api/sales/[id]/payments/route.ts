import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sales, salePayments, customerEntries } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { recalcBalances } from "@/lib/ledger";

export const dynamic = "force-dynamic";

// List every payment recorded against a sale, oldest first.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const saleId = Number(params.id);
    const rows = await db
      .select()
      .from(salePayments)
      .where(eq(salePayments.saleId, saleId))
      .orderBy(asc(salePayments.date), asc(salePayments.id));
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /sales/[id]/payments failed:", err);
    return NextResponse.json({ error: "Failed to load payments." }, { status: 500 });
  }
}

// Record a new payment (installment) against a sale — mirrors into the
// customer's ledger as a credit on the given date.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const saleId = Number(params.id);
    const { date, amount } = await req.json();
    const amt = Number(amount);
    if (!date || !Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "date and a positive amount are required" }, { status: 400 });
    }

    const [sale] = await db.select().from(sales).where(eq(sales.id, saleId));
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    if (!sale.customerId) {
      return NextResponse.json({ error: "This sale has no linked customer to post a payment against." }, { status: 400 });
    }

    const [payment] = await db.insert(salePayments).values({ saleId, date, amount: String(amt) }).returning();

    const [entry] = await db
      .insert(customerEntries)
      .values({
        customerId: sale.customerId,
        date,
        product: sale.product ?? sale.detail,
        packing: sale.packing,
        unit: sale.unit,
        debit: "0",
        credit: String(amt),
        balance: "0",
        account: "Payment",
        salePaymentId: payment.id,
      })
      .returning();

    await db.update(salePayments).set({ ledgerEntryId: entry.id }).where(eq(salePayments.id, payment.id));
    await recalcBalances(sale.customerId);

    const [{ paid }] = await db
      .select({ paid: sql<string>`COALESCE(SUM(amount),0)` })
      .from(salePayments)
      .where(eq(salePayments.saleId, saleId));

    const balance = (Number(sale.amount) - Number(paid)).toFixed(2);
    return NextResponse.json({ ...payment, paid: Number(paid).toFixed(2), balance }, { status: 201 });
  } catch (err) {
    console.error("POST /sales/[id]/payments failed:", err);
    return NextResponse.json({ error: "Failed to record payment." }, { status: 500 });
  }
}