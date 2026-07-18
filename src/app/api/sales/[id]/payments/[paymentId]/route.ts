import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sales, salePayments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recalcBalances } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; paymentId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const saleId = Number(params.id);
    const [sale] = await db.select({ customerId: sales.customerId }).from(sales).where(eq(sales.id, saleId));

    // Deleting the payment cascades to remove its mirrored credit row in
    // the customer's ledger too (customer_entries.sale_payment_id → CASCADE).
    await db.delete(salePayments).where(eq(salePayments.id, Number(params.paymentId)));

    if (sale?.customerId) await recalcBalances(sale.customerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /sales/[id]/payments/[paymentId] failed:", err);
    return NextResponse.json({ error: "Failed to delete payment." }, { status: 500 });
  }
}