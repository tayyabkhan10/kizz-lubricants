import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db";
import { purchasing } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await db.delete(purchasing).where(eq(purchasing.id, Number(params.id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /purchasing/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete purchase." }, { status: 500 });
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
    if ("amount" in b) {
      const n = Number(b.amount);
      if (!Number.isFinite(n)) return NextResponse.json({ error: "amount must be a number." }, { status: 400 });
      update.amount = String(n);
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
    }
    const [row] = await db.update(purchasing).set(update).where(eq(purchasing.id, Number(params.id))).returning();
    return NextResponse.json(row);
  } catch (err) {
    console.error("PATCH /purchasing/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update purchase." }, { status: 500 });
  }
}
