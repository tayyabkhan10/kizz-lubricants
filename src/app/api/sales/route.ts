import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { sales } from "@/db/schema";
import { asc, desc, sql, ilike } from "drizzle-orm";
import { parseListParams } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const SORT = { date: sales.date, amount: sales.amount } as const;

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
      db.select().from(sales).where(where).orderBy(...order).limit(limit).offset(offset),
      db.select({ total: sql<string>`COALESCE(SUM(amount),0)` }).from(sales).where(where),
      db.select({ count: sql<string>`COUNT(*)` }).from(sales).where(where),
    ]);

    return NextResponse.json({ rows, total: Number(total), count: Number(count), page, limit });
  } catch (err) {
    console.error("GET /sales failed:", err);
    return NextResponse.json({ error: "Failed to load sales." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { date, detail, qty, rate, amount } = await req.json();
    if (!date || !detail || amount === undefined) {
      return NextResponse.json({ error: "date, detail and amount are required" }, { status: 400 });
    }
    const [row] = await db
      .insert(sales)
      .values({ date, detail, qty: qty || null, rate: rate || null, amount: String(amount) })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("POST /sales failed:", err);
    return NextResponse.json({ error: "Failed to add sale." }, { status: 500 });
  }
}
