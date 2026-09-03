import { NextResponse } from "next/server";
import {
  deleteServerSession,
  getServerSession,
  getSessionCookieOptions,
  sessionCookieName,
} from "../../../lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const current = await getServerSession(request);
  return NextResponse.json({
    authenticated: Boolean(current),
    email: current?.session.email ?? null,
    nationalId: current?.session.nationalId ?? null,
  });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 403 });
  }

  await deleteServerSession(request);
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(sessionCookieName, "", {
    ...getSessionCookieOptions(request),
    maxAge: 0,
  });
  return response;
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
