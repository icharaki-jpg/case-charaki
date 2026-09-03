import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, or } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "../../db";
import { expertAccounts, experts } from "../../db/schema";

const accountsFile = path.join(process.cwd(), "data", "expert-accounts.json");
const passwordSaltBytes = 16;
const passwordKeyBytes = 64;

export type ServerExpertAccount = {
  expertId: string;
  email: string;
  nationalId: string;
  passwordCredential: string;
  createdAt: string;
  verifiedAt: string;
};

type AccountStoreState = {
  accounts: Map<string, ServerExpertAccount>;
  loaded: boolean;
  loadPromise?: Promise<void>;
  writePromise: Promise<void>;
};

const runtimeState = globalThis as typeof globalThis & {
  __caseCharakiAccountStore?: AccountStoreState;
};

const state =
  runtimeState.__caseCharakiAccountStore ??
  ({
    accounts: new Map<string, ServerExpertAccount>(),
    loaded: false,
    writePromise: Promise.resolve(),
  } satisfies AccountStoreState);
runtimeState.__caseCharakiAccountStore = state;

export async function registerServerExpertAccount(input: {
  email: string;
  nationalId: string;
  password: string;
}) {
  const email = input.email.trim().toLowerCase();
  const nationalId = normalizeNationalId(input.nationalId);
  const password = input.password;

  if (!isValidNationalId(nationalId)) {
    return { ok: false as const, reason: "nationalId" as const };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false as const, reason: "password" as const };
  }
  const database = getDb();
  const existing = await database.select({ email: experts.email, nationalId: experts.nationalId })
    .from(experts)
    .where(or(eq(experts.email, email), eq(experts.nationalId, nationalId))).limit(1);
  if (existing[0]?.email === email) {
    return { ok: false as const, reason: "emailExists" as const };
  }
  if (existing[0]?.nationalId === nationalId) {
    return { ok: false as const, reason: "nationalIdExists" as const };
  }

  const now = new Date();
  const [expert] = await database.insert(experts).values({
    fullName: "",
    nationalId,
    phone: "",
    email,
    expertise: "",
    licenseNumber: "",
    membershipDate: now.toISOString().slice(0, 10),
    address: "",
    notes: "",
    status: "active",
    verificationStatus: "verified",
  }).returning();
  const [account] = await database.insert(expertAccounts).values({
    expertId: expert.id,
    email,
    nationalId,
    passwordCredential: createPasswordCredential(password),
  }).returning();
  return {
    ok: true as const,
    account: {
      ...account,
      createdAt: account.createdAt.toISOString(),
      verifiedAt: account.verifiedAt.toISOString(),
    },
  };
}

export async function authenticateServerExpert(input: {
  nationalId: string;
  password: string;
}) {
  const nationalId = normalizeNationalId(input.nationalId);
  const [account] = await getDb().select().from(expertAccounts)
    .where(eq(expertAccounts.nationalId, nationalId)).limit(1);
  if (!account || !verifyPasswordCredential(input.password, account.passwordCredential)) {
    return undefined;
  }

  return account;
}

export async function findServerExpertAccount(input: {
  nationalId: string;
  email: string;
}) {
  const nationalId = normalizeNationalId(input.nationalId);
  const email = input.email.trim().toLowerCase();
  const [account] = await getDb().select().from(expertAccounts)
    .where(eq(expertAccounts.nationalId, nationalId)).limit(1);
  return account?.email === email ? account : undefined;
}

export async function changeServerExpertPassword(input: {
  nationalId: string;
  currentPassword: string;
  newPassword: string;
}) {
  const nationalId = normalizeNationalId(input.nationalId);
  const [account] = await getDb().select().from(expertAccounts)
    .where(eq(expertAccounts.nationalId, nationalId)).limit(1);
  if (!account || !verifyPasswordCredential(input.currentPassword, account.passwordCredential)) {
    return { ok: false as const, reason: "currentPassword" as const };
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return { ok: false as const, reason: "password" as const };
  }
  if (input.currentPassword === input.newPassword) {
    return { ok: false as const, reason: "samePassword" as const };
  }

  await getDb().update(expertAccounts).set({
    passwordCredential: createPasswordCredential(input.newPassword),
    updatedAt: new Date(),
  }).where(eq(expertAccounts.expertId, account.expertId));

  return { ok: true as const };
}

export async function resetServerExpertPassword(input: {
  nationalId: string;
  email: string;
  newPassword: string;
}) {
  const nationalId = normalizeNationalId(input.nationalId);
  const email = input.email.trim().toLowerCase();
  const [account] = await getDb().select().from(expertAccounts)
    .where(eq(expertAccounts.nationalId, nationalId)).limit(1);
  if (!account || account.email !== email) {
    return { ok: false as const, reason: "account" as const };
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return { ok: false as const, reason: "password" as const };
  }
  if (verifyPasswordCredential(input.newPassword, account.passwordCredential)) {
    return { ok: false as const, reason: "samePassword" as const };
  }

  await getDb().update(expertAccounts).set({
    passwordCredential: createPasswordCredential(input.newPassword),
    updatedAt: new Date(),
  }).where(eq(expertAccounts.expertId, account.expertId));

  return { ok: true as const };
}

export function normalizeNationalId(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

export function isValidNationalId(value: string) {
  return /^\d{10}$/.test(value);
}

async function ensureLoaded() {
  if (state.loaded) return;
  if (!state.loadPromise) {
    state.loadPromise = loadAccounts();
  }
  await state.loadPromise;
}

async function loadAccounts() {
  try {
    const raw = await readFile(accountsFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      for (const value of parsed) {
        if (!isStoredAccount(value)) continue;
        state.accounts.set(value.nationalId, value);
      }
    }
  } catch (error) {
    if (!isFileNotFound(error)) throw error;
  } finally {
    state.loaded = true;
  }
}

async function persist() {
  const snapshot = [...state.accounts.values()];
  state.writePromise = state.writePromise.then(async () => {
    await mkdir(path.dirname(accountsFile), { recursive: true });
    await writeFile(accountsFile, JSON.stringify(snapshot, null, 2), "utf8");
  });
  await state.writePromise;
}

function createPasswordCredential(password: string) {
  const salt = randomBytes(passwordSaltBytes);
  const digest = scryptSync(password, salt, passwordKeyBytes);
  return `${salt.toString("hex")}.${digest.toString("hex")}`;
}

function verifyPasswordCredential(password: string, credential: string) {
  const [saltHex, digestHex] = credential.split(".");
  if (!saltHex || !digestHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(digestHex)) {
    return false;
  }

  try {
    const expected = Buffer.from(digestHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function isStoredAccount(value: unknown): value is ServerExpertAccount {
  if (!isRecord(value)) return false;
  return (
    typeof value.email === "string" &&
    typeof value.nationalId === "string" &&
    typeof value.passwordCredential === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.verifiedAt === "string" &&
    isValidNationalId(value.nationalId)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFileNotFound(error: unknown): error is NodeJS.ErrnoException {
  return isRecord(error) && error.code === "ENOENT";
}
