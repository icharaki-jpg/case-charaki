import { NextResponse } from "next/server";
import { verifyVerificationChallenge } from "../../../lib/server-challenges-db";
import {
  isValidNationalId,
  normalizeNationalId,
  registerServerExpertAccount,
} from "../../../lib/server-accounts-db";

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
    typeof body.email !== "string" ||
    typeof body.challengeId !== "string" ||
    typeof body.code !== "string" ||
    typeof body.nationalId !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json({ error: "اطلاعات تأیید کامل نیست." }, { status: 400 });
  }

  const nationalId = normalizeNationalId(body.nationalId.trim());
  if (!isValidNationalId(nationalId)) {
    return NextResponse.json({ error: "کد ملی باید ۱۰ رقم باشد." }, { status: 400 });
  }
  if (body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ error: "رمز عبور باید حداقل ۸ کاراکتر باشد." }, { status: 400 });
  }

  const code = body.code.trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "کد تأیید باید شش رقم باشد." }, { status: 400 });
  }

  const result = await verifyVerificationChallenge(body.challengeId, body.email, code);
  if (!result.ok) {
    const message =
      result.reason === "missing"
        ? "کد تأیید پیدا نشد یا منقضی شده است."
        : result.reason === "locked"
          ? "تعداد تلاش‌های مجاز تمام شده است."
          : "کد واردشده صحیح نیست.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (result.purpose !== "register") {
    return NextResponse.json({ error: "این کد برای ثبت‌نام اولیه معتبر نیست." }, { status: 400 });
  }

  const account = await registerServerExpertAccount({
    email: result.email,
    nationalId,
    password: body.password,
  });
  if (!account.ok) {
    const message =
      account.reason === "emailExists"
        ? "این ایمیل قبلاً ثبت شده است."
        : account.reason === "nationalIdExists"
          ? "این کد ملی قبلاً ثبت شده است."
          : account.reason === "password"
            ? "رمز عبور باید حداقل ۸ کاراکتر باشد."
            : "اطلاعات حساب کارشناس نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({
    authenticated: false,
    registered: true,
    email: account.account.email,
    nationalId: account.account.nationalId,
  });
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
