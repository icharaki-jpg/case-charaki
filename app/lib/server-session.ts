import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const sessionLifetimeMs = 8 * 60 * 60 * 1000;
const sessionsFile = path.join(process.cwd(), "data", "sessions.json");

export const sessionCookieName = "case_charaki_session";
export const sessionLifetimeSeconds = Math.floor(sessionLifetimeMs / 1000);

export type ServerSession = {
  email: string;
  nationalId: string;
  createdAt: number;
  expiresAt: number;
};

type StoredSession = {
  token: string;
  session: ServerSession;
};

type SessionStoreState = {
  sessions: Map<string, ServerSession>;
  loaded: boolean;
  loadPromise?: Promise<void>;
  writePromise: Promise<void>;
};

const runtimeState = globalThis as typeof globalThis & {
  __caseCharakiSessionStore?: SessionStoreState;
};

const state =
  runtimeState.__caseCharakiSessionStore ??
  ({
    sessions: new Map<string, ServerSession>(),
    loaded: false,
    writePromise: Promise.resolve(),
  } satisfies SessionStoreState);
runtimeState.__caseCharakiSessionStore = state;

export async function createServerSession(emailValue: string, nationalIdValue: string) {
  await ensureLoaded();
  removeExpiredSessions();

  const now = Date.now();
  const session: ServerSession = {
    email: emailValue.trim().toLowerCase(),
    nationalId: nationalIdValue.trim(),
    createdAt: now,
    expiresAt: now + sessionLifetimeMs,
  };
  const token = randomBytes(32).toString("base64url");
  state.sessions.set(token, session);
  await persist();

  return { token, session };
}

export function getSessionToken(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex < 0) continue;
    const name = cookie.slice(0, separatorIndex).trim();
    if (name !== sessionCookieName) continue;
    return cookie.slice(separatorIndex + 1).trim() || undefined;
  }

  return undefined;
}

export async function getServerSession(request: Request) {
  await ensureLoaded();
  removeExpiredSessions();

  const token = getSessionToken(request);
  if (!token) return undefined;

  const session = state.sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) return undefined;
  return { token, session };
}

export async function deleteServerSession(request: Request) {
  await ensureLoaded();
  const token = getSessionToken(request);
  if (!token || !state.sessions.delete(token)) return;
  await persist();
}

export function getSessionCookieOptions(request: Request) {
  let secure = process.env.NODE_ENV === "production";
  try {
    secure = new URL(request.url).protocol === "https:";
  } catch {
    // Keep the production default if the request URL is unavailable.
  }

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: sessionLifetimeSeconds,
  };
}

async function ensureLoaded() {
  if (state.loaded) return;
  if (!state.loadPromise) {
    state.loadPromise = loadSessions();
  }
  await state.loadPromise;
}

async function loadSessions() {
  try {
    const raw = await readFile(sessionsFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      for (const value of parsed) {
        if (!isStoredSession(value)) continue;
        state.sessions.set(value.token, value.session);
      }
    }
  } catch (error) {
    if (!isFileNotFound(error)) throw error;
  } finally {
    state.loaded = true;
  }
}

function removeExpiredSessions(now = Date.now()) {
  for (const [token, session] of state.sessions) {
    if (session.expiresAt <= now) {
      state.sessions.delete(token);
    }
  }
}

async function persist() {
  const snapshot: StoredSession[] = [...state.sessions.entries()].map(([token, session]) => ({
    token,
    session,
  }));
  state.writePromise = state.writePromise.then(async () => {
    await mkdir(path.dirname(sessionsFile), { recursive: true });
    await writeFile(sessionsFile, JSON.stringify(snapshot, null, 2), "utf8");
  });
  await state.writePromise;
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!isRecord(value) || typeof value.token !== "string" || !isRecord(value.session)) {
    return false;
  }
  return (
    typeof value.session.email === "string" &&
    typeof value.session.nationalId === "string" &&
    typeof value.session.createdAt === "number" &&
    typeof value.session.expiresAt === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === "ENOENT";
}
