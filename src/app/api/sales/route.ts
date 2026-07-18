

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sales, customers, customerEntries, salePayments } from "@/db/schema";
import { asc, desc, eq, sql, ilike, inArray } from "drizzle-orm";
import { parseListParams } from "@/lib/pagination";
import { recalcBalances } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const SORT = { date: sales.date, amount: sales.amount } as const;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { search, page, limit, offset, sort, dir } = parseListParams(req, {
      sortable: Object.keys(SORT),
      defaultSort: "date",
    });
    const where = search ? ilike(sales.detail, `%${search}%`) : undefined;
    const col = SORT[sort as keyof typeof SORT];
    const order = dir === "asc" ? [asc(col), asc(sales.id)] : [desc(col), desc(sales.id)];

    const [rows, [{ total }], [{ count }]] = await Promise.all([
      db
        .select({
          id: sales.id,
          date: sales.date,
          detail: sales.detail,
          product: sales.product,
          packing: sales.packing,
          unit: sales.unit,
          qty: sales.qty,
          rate: sales.rate,
          amount: sales.amount,
          customerId: sales.customerId,
          customerName: customers.name,
        })
        .from(sales)
        .leftJoin(customers, eq(sales.customerId, customers.id))
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset(offset),
      db.select({ total: sql<string>`COALESCE(SUM(amount),0)` }).from(sales).where(where),
      db.select({ count: sql<string>`COUNT(*)` }).from(sales).where(where),
    ]);

    // Attach paid/balance per sale — sum of any recorded sale_payments rows.
    const ids = rows.map((r) => r.id);
    const paymentSums = ids.length
      ? await db
          .select({ saleId: salePayments.saleId, paid: sql<string>`COALESCE(SUM(${salePayments.amount}),0)` })
          .from(salePayments)
          .where(inArray(salePayments.saleId, ids))
          .groupBy(salePayments.saleId)
      : [];
    const paidMap = new Map(paymentSums.map((p) => [p.saleId, Number(p.paid)]));
    const rowsWithBalance = rows.map((r) => {
      const paid = paidMap.get(r.id) ?? 0;
      const amount = Number(r.amount);
      return { ...r, paid: paid.toFixed(2), balance: (amount - paid).toFixed(2) };
    });

    return NextResponse.json({ rows: rowsWithBalance, total: Number(total), count: Number(count), page, limit });
  } catch (err) {
    console.error("GET /sales failed:", err);
    return NextResponse.json({ error: "Failed to load sales." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { date, detail, product, packing, unit, qty, rate, amount, credit, customerId } = await req.json();
    if (!date || !detail || amount === undefined) {
      return NextResponse.json({ error: "date, detail and amount are required" }, { status: 400 });
    }
    const custId = customerId ? Number(customerId) : null;

    const [row] = await db
      .insert(sales)
      .values({
        date,
        detail,
        product: str(product),
        packing: str(packing),
        unit: str(unit),
        qty: num(qty),
        rate: num(rate),
        amount: String(amount),
        customerId: custId,
      })
      .returning();

    // Automation: mirror the sale into the customer's ledger as a debit,
    // and — if any amount was already received — post a payment (credit)
    // on the same date too, so the balance reflects what's actually owed.
    if (custId) {
      const [entry] = await db
        .insert(customerEntries)
        .values({
          customerId: custId,
          date,
          product: str(product) ?? detail,
          packing: str(packing),
          unit: str(unit),
          qty: num(qty),
          rate: num(rate),
          debit: String(amount),
          credit: "0",
          balance: "0", // recalculated below
          account: "Sale",
          saleId: row.id,
        })
        .returning();
      await db.update(sales).set({ ledgerEntryId: entry.id }).where(eq(sales.id, row.id));

      const creditAmt = Number(credit ?? 0);
      if (creditAmt > 0) {
        const [payment] = await db.insert(salePayments).values({ saleId: row.id, date, amount: String(creditAmt) }).returning();
        const [payEntry] = await db
          .insert(customerEntries)
          .values({
            customerId: custId,
            date,
            product: str(product) ?? detail,
            packing: str(packing),
            unit: str(unit),
            debit: "0",
            credit: String(creditAmt),
            balance: "0",
            account: "Payment",
            salePaymentId: payment.id,
          })
          .returning();
        await db.update(salePayments).set({ ledgerEntryId: payEntry.id }).where(eq(salePayments.id, payment.id));
      }

      await recalcBalances(custId);
    }

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("POST /sales failed:", err);
    return NextResponse.json({ error: "Failed to add sale." }, { status: 500 });
  }
}