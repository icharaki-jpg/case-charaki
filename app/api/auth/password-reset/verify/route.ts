import { NextResponse } from "next/server";
import {
  isValidNationalId,
  normalizeNationalId,
  resetServerExpertPassword,
} from "../../../../lib/server-accounts-db";
import { verifyVerificationChallenge } from "../../../../lib/server-challenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16 * 1024) {
      return NextResponse.json({ error: "درخواست بیش از حد مجاز است." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.nationalId !== "string" ||
    typeof body.email !== "string" ||
    typeof body.challengeId !== "string" ||
    typeof body.code !== "string" ||
    typeof body.newPassword !== "string"
  ) {
    return NextResponse.json({ error: "اطلاعات بازیابی رمز کامل نیست." }, { status: 400 });
  }

  const nationalId = normalizeNationalId(body.nationalId.trim());
  const email = body.email.trim().toLowerCase();
  const code = toLatinDigits(body.code.trim());
  if (!isValidNationalId(nationalId)) {
    return NextResponse.json({ error: "کد ملی باید ۱۰ رقم باشد." }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "کد تأیید باید شش رقم باشد." }, { status: 400 });
  }
  if (body.newPassword.length < 8 || body.newPassword.length > 128) {
    return NextResponse.json({ error: "رمز جدید باید حداقل ۸ کاراکتر باشد." }, { status: 400 });
  }

  const result = verifyVerificationChallenge(body.challengeId, email, code);
  if (!result.ok) {
    const message =
      result.reason === "missing"
        ? "کد تأیید پیدا نشد یا منقضی شده است."
        : result.reason === "locked"
          ? "تعداد تلاش‌های مجاز تمام شده است."
          : "کد واردشده صحیح نیست.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (result.purpose !== "resetPassword") {
    return NextResponse.json({ error: "این کد برای بازیابی رمز عبور معتبر نیست." }, { status: 400 });
  }

  const resetResult = await resetServerExpertPassword({
    nationalId,
    email,
    newPassword: body.newPassword,
  });
  if (!resetResult.ok) {
    const message =
      resetResult.reason === "samePassword"
        ? "رمز جدید باید با رمز قبلی متفاوت باشد."
        : resetResult.reason === "password"
          ? "رمز جدید باید حداقل ۸ کاراکتر باشد."
          : "اطلاعات حساب کارشناس مطابقت ندارد.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ reset: true });
}

function toLatinDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
