import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { experts } from "../../../../db/schema";
import {
  authenticateServerExpert,
  isValidNationalId,
  normalizeNationalId,
} from "../../../lib/server-accounts-db";
import {
  createServerSession,
  getSessionCookieOptions,
  sessionCookieName,
} from "../../../lib/server-session-db";

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
    typeof body.password !== "string"
  ) {
    return NextResponse.json({ error: "کد ملی و رمز عبور الزامی است." }, { status: 400 });
  }

  const nationalId = normalizeNationalId(body.nationalId.trim());
  if (!isValidNationalId(nationalId)) {
    return NextResponse.json({ error: "کد ملی باید ۱۰ رقم باشد." }, { status: 400 });
  }
  if (body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ error: "رمز عبور باید حداقل ۸ کاراکتر باشد." }, { status: 400 });
  }

  const account = await authenticateServerExpert({
    nationalId,
    password: body.password,
  });
  if (!account) {
    return NextResponse.json({ error: "کد ملی یا رمز عبور نادرست است." }, { status: 401 });
  }

  const { token, session } = await createServerSession(account.email, account.nationalId);
  const response = NextResponse.json({
    authenticated: true,
    email: session.email,
    nationalId: session.nationalId,
    expiresAt: session.expiresAt,
    expert: (await getDb().select().from(experts).where(eq(experts.nationalId, account.nationalId)).limit(1))[0] ?? null,
  });
  response.cookies.set(sessionCookieName, token, getSessionCookieOptions(request));
  return response;
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
