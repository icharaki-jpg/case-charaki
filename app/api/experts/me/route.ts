import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { experts } from "../../../../db/schema";
import { getServerSession } from "../../../lib/server-session-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const profileFields = [
  "fullName",
  "phone",
  "expertise",
  "licenseNumber",
  "membershipDate",
  "address",
  "notes",
  "meetingReminderEnabled",
  "meetingReminderDays",
] as const;

export async function GET(request: Request) {
  const current = await getServerSession(request);
  if (!current) return NextResponse.json({ error: "ورود معتبر نیست." }, { status: 401 });

  const [expert] = await getDb().select().from(experts)
    .where(eq(experts.nationalId, current.session.nationalId)).limit(1);
  if (!expert) return NextResponse.json({ error: "اطلاعات حساب کارشناس پیدا نشد." }, { status: 404 });

  return NextResponse.json({ expert });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  }

  const current = await getServerSession(request);
  if (!current) return NextResponse.json({ error: "ورود معتبر نیست." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "اطلاعات پروفایل نامعتبر است." }, { status: 400 });
  }

  const [currentExpert] = await getDb().select().from(experts)
    .where(eq(experts.nationalId, current.session.nationalId)).limit(1);
  if (!currentExpert) return NextResponse.json({ error: "اطلاعات حساب کارشناس پیدا نشد." }, { status: 404 });

  const values: Record<string, unknown> = {};
  for (const field of profileFields) {
    if (field in body) values[field] = body[field];
  }

  const fullName = typeof values.fullName === "string" ? values.fullName.trim() : "";
  const expertise = typeof values.expertise === "string" ? values.expertise.trim() : "";
  const phone = typeof values.phone === "string" ? values.phone.trim() : "";
  const meetingReminderDays = typeof values.meetingReminderDays === "number"
    ? values.meetingReminderDays
    : 2;

  if (!fullName || !expertise) {
    return NextResponse.json({ error: "نام و رشته کارشناسی الزامی است." }, { status: 400 });
  }
  if (phone && !/^09\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "شماره تلفن نامعتبر است." }, { status: 400 });
  }
  if (!Number.isInteger(meetingReminderDays) || meetingReminderDays < 1 || meetingReminderDays > 30) {
    return NextResponse.json({ error: "تعداد روز یادآوری باید بین ۱ تا ۳۰ باشد." }, { status: 400 });
  }

  const update = {
    fullName,
    phone,
    expertise,
    licenseNumber: typeof values.licenseNumber === "string" ? values.licenseNumber.trim() : "",
    membershipDate: typeof values.membershipDate === "string" && values.membershipDate.trim()
      ? values.membershipDate.trim()
      : currentExpert.membershipDate,
    address: typeof values.address === "string" ? values.address.trim() : currentExpert.address,
    notes: typeof values.notes === "string" ? values.notes.trim() : currentExpert.notes,
    meetingReminderEnabled: values.meetingReminderEnabled !== false,
    meetingReminderDays,
    updatedAt: new Date(),
  };

  const [expert] = await getDb().update(experts).set(update)
    .where(eq(experts.nationalId, current.session.nationalId)).returning();
  if (!expert) return NextResponse.json({ error: "اطلاعات حساب کارشناس پیدا نشد." }, { status: 404 });

  return NextResponse.json({ expert });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSameOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
