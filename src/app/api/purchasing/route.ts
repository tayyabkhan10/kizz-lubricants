import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { purchasing } from "@/db/schema";
import { asc, desc, sql, ilike } from "drizzle-orm";
import { parseListParams } from "@/lib/pagination";

const SORT = { date: purchasing.date, amount: purchasing.amount } as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { search, page, limit, offset, sort, dir } = parseListParams(req, {
    sortable: Object.keys(SORT),
    defaultSort: "date",
  });
  const where = search ? ilike(purchasing.detail, `%${search}%`) : undefined;
  const col = SORT[sort as keyof typeof SORT];
  const order = dir === "asc" ? [asc(col), asc(purchasing.id)] : [desc(col), desc(purchasing.id)];

  const [rows, [{ total }], [{ count }]] = await Promise.all([
    db.select().from(purchasing).where(where).orderBy(...order).limit(limit).offset(offset),
    db.select({ total: sql<string>`COALESCE(SUM(amount),0)` }).from(purchasing).where(where),
    db.select({ count: sql<string>`COUNT(*)` }).from(purchasing).where(where),
  ]);

  return NextResponse.json({ rows, total: Number(total), count: Number(count), page, limit });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { date, detail, amount } = await req.json();
  if (!date || !detail || amount === undefined) return NextResponse.json({ error: "date, detail and amount required" }, { status: 400 });
  const [row] = await db.insert(purchasing).values({ date, detail, amount: String(amount) }).returning();
  return NextResponse.json(row, { status: 201 });
}
