import { NextResponse } from "next/server";
import {
  findServerExpertAccount,
  isValidNationalId,
  normalizeNationalId,
} from "../../../../lib/server-accounts";
import { createVerificationChallenge } from "../../../../lib/server-challenges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    typeof body.email !== "string"
  ) {
    return NextResponse.json({ error: "کد ملی و ایمیل را وارد کنید." }, { status: 400 });
  }

  const nationalId = normalizeNationalId(body.nationalId.trim());
  const email = body.email.trim().toLowerCase();
  if (!isValidNationalId(nationalId)) {
    return NextResponse.json({ error: "کد ملی باید ۱۰ رقم باشد." }, { status: 400 });
  }
  if (email.length > 254 || !emailPattern.test(email)) {
    return NextResponse.json({ error: "ایمیل کارشناس نامعتبر است." }, { status: 400 });
  }

  const account = await findServerExpertAccount({ nationalId, email });
  if (!account) {
    return NextResponse.json(
      { error: "کد ملی و ایمیل با اطلاعات حساب کارشناس مطابقت ندارد." },
      { status: 404 },
    );
  }

  const result = createVerificationChallenge(email, "resetPassword");
  const response: {
    challengeId: string;
    expiresAt: number;
    devCode?: string;
  } = {
    challengeId: result.challengeId,
    expiresAt: result.challenge.expiresAt,
  };

  const showDevelopmentCode =
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_DEV_VERIFICATION_CODE === "true";
  if (showDevelopmentCode) {
    response.devCode = result.challenge.code;
    console.info(`[توسعه] کد بازیابی رمز ${email}: ${result.challenge.code}`);
  }

  return NextResponse.json(response);
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
