import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { caseFees, cases, experts } from "../../../../db/schema";
import { getServerSession } from "../../../lib/server-session-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const feeStatuses = ["unselected", "sendToCenter", "followUp", "collected"] as const;
type FeeStatus = (typeof feeStatuses)[number];

export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const current = await getServerSession(request);
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const { caseId } = await context.params;
  let body: { differenceFee?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است." }, { status: 400 });
  }

  const differenceFee = typeof body.differenceFee === "string" ? body.differenceFee : "";
  const status = body.status;
  if (typeof status !== "string" || !feeStatuses.includes(status as FeeStatus)) {
    return NextResponse.json({ error: "وضعیت دستمزد نامعتبر است." }, { status: 400 });
  }

  try {
    const db = getDb();
    const expert = await db.select({ id: experts.id })
      .from(experts)
      .where(eq(experts.nationalId, current.session.nationalId))
      .limit(1);
    if (!expert[0]) return NextResponse.json({ error: "حساب کارشناس پیدا نشد." }, { status: 404 });

    const ownedCase = await db.select({ id: cases.id })
      .from(cases)
      .where(and(eq(cases.id, caseId), eq(cases.expertId, expert[0].id)))
      .limit(1);
    if (!ownedCase[0]) return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });

    const existing = await db.select({ id: caseFees.id })
      .from(caseFees)
      .where(and(eq(caseFees.caseId, caseId), eq(caseFees.expertId, expert[0].id)))
      .limit(1);
    const now = new Date();
    const fee = existing[0]
      ? (await db.update(caseFees)
        .set({ differenceFee, status, updatedAt: now })
        .where(eq(caseFees.id, existing[0].id))
        .returning())[0]
      : (await db.insert(caseFees)
        .values({ caseId, expertId: expert[0].id, differenceFee, status, createdAt: now, updatedAt: now })
        .returning())[0];

    return NextResponse.json({
      fee: {
        id: fee.id,
        caseId: fee.caseId,
        differenceFee: fee.differenceFee,
        status: fee.status,
        updatedAt: fee.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("case fee PATCH failed", error);
    return NextResponse.json({ error: "ذخیره دستمزد کارشناسی انجام نشد." }, { status: 500 });
  }
}
