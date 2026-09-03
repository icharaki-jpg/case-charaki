import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cases, experts } from "../../../db/schema";
import { getServerSession } from "../../lib/server-session-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fields = [
  "caseNumber", "referralSource", "expertOrder", "referralDate", "meetingDate",
  "meetingTime", "deadline", "advanceFee", "claimant", "claimantPhone",
  "respondent", "respondentPhone", "claimantLawyer", "claimantLawyerPhone",
  "respondentLawyer", "respondentLawyerPhone", "description",
] as const;

export async function GET(request: Request) {
  const current = await getServerSession(request);
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  try {
    const db = getDb();
    const expert = await db.select({ id: experts.id }).from(experts)
      .where(eq(experts.nationalId, current.session.nationalId)).limit(1);
    if (!expert[0]) return NextResponse.json({ cases: [] });
    const rows = await db.select().from(cases)
      .where(eq(cases.expertId, expert[0].id))
      .orderBy(desc(cases.createdAt));
    return NextResponse.json({ cases: rows.map(toClientCase) });
  } catch (error) {
    console.error("cases GET failed", error);
    return NextResponse.json({ error: "دریافت پرونده‌ها انجام نشد." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const current = await getServerSession(request);
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "بدنه درخواست نامعتبر است." }, { status: 400 });
  try {
    const db = getDb();
    const expert = await db.select({ id: experts.id })
      .from(experts)
      .where(eq(experts.nationalId, current.session.nationalId))
      .limit(1);
    if (!expert[0]) return NextResponse.json({ error: "حساب کارشناس پیدا نشد." }, { status: 404 });
    const inserted = await db.insert(cases).values(toInsert(body, expert[0].id)).returning();
    return NextResponse.json({ case: toClientCase(inserted[0]) }, { status: 201 });
  } catch (error) {
    console.error("cases POST failed", error);
    return NextResponse.json({ error: "ثبت پرونده انجام نشد." }, { status: 500 });
  }
}

async function readBody(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

function toInsert(body: Record<string, unknown>, expertId: string) {
  const result: Record<string, string> = {};
  for (const field of fields) result[field] = typeof body[field] === "string" ? body[field] as string : "";
  return {
    expertId,
    caseNumber: result.caseNumber,
    referralSource: result.referralSource,
    expertOrder: result.expertOrder,
    referralDate: result.referralDate,
    meetingDate: result.meetingDate,
    meetingTime: result.meetingTime,
    deadline: result.deadline,
    advanceFee: result.advanceFee,
    claimant: result.claimant,
    claimantPhone: result.claimantPhone,
    respondent: result.respondent,
    respondentPhone: result.respondentPhone,
    claimantLawyer: result.claimantLawyer,
    claimantLawyerPhone: result.claimantLawyerPhone,
    respondentLawyer: result.respondentLawyer,
    respondentLawyerPhone: result.respondentLawyerPhone,
    description: result.description,
  };
}

function toClientCase(row: typeof cases.$inferSelect) {
  return { ...row, id: row.id, expertId: row.expertId ?? undefined, createdAt: row.createdAt.toISOString() };
}
