import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cases, experts } from "../../../../db/schema";
import { getServerSession } from "../../../lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutate(request, context, "patch");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return mutate(request, context, "delete");
}

async function mutate(request: Request, context: { params: Promise<{ id: string }> }, operation: "patch" | "delete") {
  const current = await getServerSession(request);
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const { id } = await context.params;
  try {
    const db = getDb();
    const expert = await db.select({ id: experts.id }).from(experts)
      .where(eq(experts.nationalId, current.session.nationalId)).limit(1);
    if (!expert[0]) return NextResponse.json({ error: "حساب کارشناس پیدا نشد." }, { status: 404 });
    const filter = and(eq(cases.id, id), eq(cases.expertId, expert[0].id));
    if (operation === "delete") {
      await db.delete(cases).where(filter);
      return NextResponse.json({ deleted: true });
    }
    const body = await request.json();
    const updated = await db.update(cases).set({ ...body, updatedAt: new Date() }).where(filter).returning();
    if (!updated[0]) return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
    return NextResponse.json({ case: updated[0] });
  } catch (error) {
    console.error("case mutation failed", error);
    return NextResponse.json({ error: "ذخیره پرونده انجام نشد." }, { status: 500 });
  }
}
