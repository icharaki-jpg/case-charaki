import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const accountsFile = path.join(process.cwd(), "data", "expert-accounts.json");
const passwordSaltBytes = 16;
const passwordKeyBytes = 64;

export type ServerExpertAccount = {
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
  await ensureLoaded();

  const email = input.email.trim().toLowerCase();
  const nationalId = normalizeNationalId(input.nationalId);
  const password = input.password;

  if (!isValidNationalId(nationalId)) {
    return { ok: false as const, reason: "nationalId" as const };
  }
  if (password.length < 8 || password.length > 128) {
    return { ok: false as const, reason: "password" as const };
  }
  if ([...state.accounts.values()].some((account) => account.email === email)) {
    return { ok: false as const, reason: "emailExists" as const };
  }
  if (state.accounts.has(nationalId)) {
    return { ok: false as const, reason: "nationalIdExists" as const };
  }

  const now = new Date().toISOString();
  const account: ServerExpertAccount = {
    email,
    nationalId,
    passwordCredential: createPasswordCredential(password),
    createdAt: now,
    verifiedAt: now,
  };
  state.accounts.set(nationalId, account);
  await persist();

  return { ok: true as const, account };
}

export async function authenticateServerExpert(input: {
  nationalId: string;
  password: string;
}) {
  await ensureLoaded();

  const nationalId = normalizeNationalId(input.nationalId);
  const account = state.accounts.get(nationalId);
  if (!account || !verifyPasswordCredential(input.password, account.passwordCredential)) {
    return undefined;
  }

  return account;
}

export async function findServerExpertAccount(input: {
  nationalId: string;
  email: string;
}) {
  await ensureLoaded();

  const nationalId = normalizeNationalId(input.nationalId);
  const email = input.email.trim().toLowerCase();
  const account = state.accounts.get(nationalId);
  return account?.email === email ? account : undefined;
}

export async function changeServerExpertPassword(input: {
  nationalId: string;
  currentPassword: string;
  newPassword: string;
}) {
  await ensureLoaded();

  const nationalId = normalizeNationalId(input.nationalId);
  const account = state.accounts.get(nationalId);
  if (!account || !verifyPasswordCredential(input.currentPassword, account.passwordCredential)) {
    return { ok: false as const, reason: "currentPassword" as const };
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return { ok: false as const, reason: "password" as const };
  }
  if (input.currentPassword === input.newPassword) {
    return { ok: false as const, reason: "samePassword" as const };
  }

  const updatedAccount: ServerExpertAccount = {
    ...account,
    passwordCredential: createPasswordCredential(input.newPassword),
  };
  state.accounts.set(nationalId, updatedAccount);
  await persist();

  return { ok: true as const };
}

export async function resetServerExpertPassword(input: {
  nationalId: string;
  email: string;
  newPassword: string;
}) {
  await ensureLoaded();

  const nationalId = normalizeNationalId(input.nationalId);
  const email = input.email.trim().toLowerCase();
  const account = state.accounts.get(nationalId);
  if (!account || account.email !== email) {
    return { ok: false as const, reason: "account" as const };
  }
  if (input.newPassword.length < 8 || input.newPassword.length > 128) {
    return { ok: false as const, reason: "password" as const };
  }
  if (verifyPasswordCredential(input.newPassword, account.passwordCredential)) {
    return { ok: false as const, reason: "samePassword" as const };
  }

  state.accounts.set(nationalId, {
    ...account,
    passwordCredential: createPasswordCredential(input.newPassword),
  });
  await persist();

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
