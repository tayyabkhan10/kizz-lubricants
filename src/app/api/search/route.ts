import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { customers, sales, purchasing, expenses, salary } from "@/db/schema";
import { ilike, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const EMPTY = { customers: [], sales: [], purchasing: [], expenses: [], salary: [] };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json(EMPTY);
  const like = `%${q}%`;

  try {
    const [cust, sal, pur, exp, salr] = await Promise.all([
      db
        .select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address })
        .from(customers)
        .where(or(ilike(customers.name, like), ilike(customers.phone, like), ilike(customers.address, like)))
        .limit(6),
      db
        .select({ id: sales.id, date: sales.date, detail: sales.detail, amount: sales.amount })
        .from(sales)
        .where(ilike(sales.detail, like))
        .orderBy(desc(sales.date))
        .limit(5),
      db
        .select({ id: purchasing.id, date: purchasing.date, detail: purchasing.detail, amount: purchasing.amount })
        .from(purchasing)
        .where(ilike(purchasing.detail, like))
        .orderBy(desc(purchasing.date))
        .limit(5),
      db
        .select({ id: expenses.id, date: expenses.date, detail: expenses.detail, amount: expenses.amount })
        .from(expenses)
        .where(ilike(expenses.detail, like))
        .orderBy(desc(expenses.date))
        .limit(5),
      db
        .select({ id: salary.id, date: salary.date, employee: salary.employee, amount: salary.amount })
        .from(salary)
        .where(ilike(salary.employee, like))
        .orderBy(desc(salary.date))
        .limit(5),
    ]);

    return NextResponse.json({ customers: cust, sales: sal, purchasing: pur, expenses: exp, salary: salr });
  } catch (err) {
    console.error("GET /search failed:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
