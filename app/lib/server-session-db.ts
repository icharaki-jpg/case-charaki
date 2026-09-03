import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../db";
import { expertAccounts, experts, sessions } from "../../db/schema";

const sessionLifetimeMs = 8 * 60 * 60 * 1000;
export const sessionCookieName = "case_charaki_session";
export const sessionLifetimeSeconds = Math.floor(sessionLifetimeMs / 1000);

export async function createServerSession(email: string, nationalId: string) {
  const db = getDb();
  const [account] = await db.select({ expertId: expertAccounts.expertId }).from(expertAccounts)
    .where(eq(expertAccounts.nationalId, nationalId)).limit(1);
  if (!account) throw new Error("Expert account not found.");
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + sessionLifetimeMs);
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ tokenHash: hashToken(token), expertId: account.expertId, createdAt, expiresAt });
  return { token, session: { email: email.trim().toLowerCase(), nationalId, createdAt: createdAt.getTime(), expiresAt: expiresAt.getTime() } };
}

export function getSessionToken(request: Request) {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index >= 0 && item.slice(0, index).trim() === sessionCookieName) return item.slice(index + 1).trim() || undefined;
  }
  return undefined;
}

export async function getServerSession(request: Request) {
  const token = getSessionToken(request);
  if (!token) return undefined;
  const [row] = await getDb().select({
    email: experts.email, nationalId: experts.nationalId, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt,
  }).from(sessions).innerJoin(experts, eq(sessions.expertId, experts.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!row) return undefined;
  return { token, session: { email: row.email, nationalId: row.nationalId, createdAt: row.createdAt.getTime(), expiresAt: row.expiresAt.getTime() } };
}

export async function deleteServerSession(request: Request) {
  const token = getSessionToken(request);
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export function getSessionCookieOptions(request: Request) {
  let secure = process.env.NODE_ENV === "production";
  try { secure = new URL(request.url).protocol === "https:"; } catch {}
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: sessionLifetimeSeconds };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
