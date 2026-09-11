import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { caseFees, cases, experts } from "../../../db/schema";
import { getServerSession } from "../../lib/server-session-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const feeStatuses = ["sendToCenter", "followUp", "collected"] as const;
export type FeeStatus = (typeof feeStatuses)[number];

export async function GET(request: Request) {
  const current = await getServerSession(request);
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  try {
    const db = getDb();
    const expert = await db.select({ id: experts.id })
      .from(experts)
      .where(eq(experts.nationalId, current.session.nationalId))
      .limit(1);
    if (!expert[0]) return NextResponse.json({ fees: [] });

    const rows = await db.select({
      caseId: cases.id,
      caseNumber: cases.caseNumber,
      claimant: cases.claimant,
      respondent: cases.respondent,
      advanceFee: cases.advanceFee,
      feeId: caseFees.id,
      differenceFee: caseFees.differenceFee,
      status: caseFees.status,
      updatedAt: caseFees.updatedAt,
    })
      .from(cases)
      .leftJoin(caseFees, and(eq(caseFees.caseId, cases.id), eq(caseFees.expertId, expert[0].id)))
      .where(and(eq(cases.expertId, expert[0].id), ne(cases.advanceFee, "")))
      .orderBy(desc(cases.createdAt));

    return NextResponse.json({
      fees: rows.map((row) => ({
        ...row,
        differenceFee: row.differenceFee ?? "",
        status: isFeeStatus(row.status) ? row.status : "sendToCenter",
        updatedAt: row.updatedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("case fees GET failed", error);
    return NextResponse.json({ error: "دریافت دستمزدهای کارشناسی انجام نشد." }, { status: 500 });
  }
}

function isFeeStatus(value: string | null): value is FeeStatus {
  return Boolean(value && feeStatuses.includes(value as FeeStatus));
}
