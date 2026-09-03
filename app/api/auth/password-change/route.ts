import { NextResponse } from "next/server";
import { changeServerExpertPassword } from "../../../lib/server-accounts-db";
import { getServerSession } from "../../../lib/server-session-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  }

  const currentSession = await getServerSession(request);
  if (!currentSession) {
    return NextResponse.json({ error: "برای تغییر رمز ابتدا وارد شوید." }, { status: 401 });
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
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string"
  ) {
    return NextResponse.json({ error: "رمز فعلی و رمز جدید را وارد کنید." }, { status: 400 });
  }

  if (body.newPassword.length < 8 || body.newPassword.length > 128) {
    return NextResponse.json({ error: "رمز جدید باید حداقل ۸ کاراکتر باشد." }, { status: 400 });
  }

  const result = await changeServerExpertPassword({
    nationalId: currentSession.session.nationalId,
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
  });

  if (!result.ok) {
    const error =
      result.reason === "samePassword"
        ? "رمز جدید باید با رمز فعلی متفاوت باشد."
        : result.reason === "password"
          ? "رمز جدید باید حداقل ۸ کاراکتر باشد."
          : "رمز فعلی نادرست است.";
    return NextResponse.json({ error }, { status: 401 });
  }

  return NextResponse.json({ updated: true });
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
