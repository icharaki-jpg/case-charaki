import "server-only";

import { eq, or } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "../../db";
import { expertAccounts, experts } from "../../db/schema";

const passwordSaltBytes = 16;
const passwordKeyBytes = 64;

export async function registerServerExpertAccount(input: { email: string; nationalId: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const nationalId = normalizeNationalId(input.nationalId);
  if (!isValidNationalId(nationalId)) return { ok: false as const, reason: "nationalId" as const };
  if (input.password.length < 8 || input.password.length > 128) return { ok: false as const, reason: "password" as const };
  const db = getDb();
  const [existing] = await db.select({ email: experts.email, nationalId: experts.nationalId }).from(experts)
    .where(or(eq(experts.email, email), eq(experts.nationalId, nationalId))).limit(1);
  if (existing?.email === email) return { ok: false as const, reason: "emailExists" as const };
  if (existing?.nationalId === nationalId) return { ok: false as const, reason: "nationalIdExists" as const };
  const [expert] = await db.insert(experts).values({
    fullName: "", nationalId, phone: "", email, expertise: "", licenseNumber: "",
    membershipDate: new Date().toISOString().slice(0, 10), address: "", notes: "",
    status: "active", verificationStatus: "verified",
  }).returning();
  const [account] = await db.insert(expertAccounts).values({
    expertId: expert.id, email, nationalId, passwordCredential: createPasswordCredential(input.password),
  }).returning();
  return { ok: true as const, account };
}

export async function authenticateServerExpert(input: { nationalId: string; password: string }) {
  const [account] = await getDb().select().from(expertAccounts)
    .where(eq(expertAccounts.nationalId, normalizeNationalId(input.nationalId))).limit(1);
  return account && verifyPasswordCredential(input.password, account.passwordCredential) ? account : undefined;
}

export async function findServerExpertAccount(input: { nationalId: string; email: string }) {
  const [account] = await getDb().select().from(expertAccounts)
    .where(eq(expertAccounts.nationalId, normalizeNationalId(input.nationalId))).limit(1);
  return account?.email === input.email.trim().toLowerCase() ? account : undefined;
}

export async function changeServerExpertPassword(input: { nationalId: string; currentPassword: string; newPassword: string }) {
  const [account] = await getDb().select().from(expertAccounts)
    .where(eq(expertAccounts.nationalId, normalizeNationalId(input.nationalId))).limit(1);
  if (!account || !verifyPasswordCredential(input.currentPassword, account.passwordCredential)) return { ok: false as const, reason: "currentPassword" as const };
  if (input.newPassword.length < 8 || input.newPassword.length > 128) return { ok: false as const, reason: "password" as const };
  if (input.currentPassword === input.newPassword) return { ok: false as const, reason: "samePassword" as const };
  await getDb().update(expertAccounts).set({ passwordCredential: createPasswordCredential(input.newPassword), updatedAt: new Date() })
    .where(eq(expertAccounts.expertId, account.expertId));
  return { ok: true as const };
}

export async function resetServerExpertPassword(input: { nationalId: string; email: string; newPassword: string }) {
  const account = await findServerExpertAccount(input);
  if (!account) return { ok: false as const, reason: "account" as const };
  if (input.newPassword.length < 8 || input.newPassword.length > 128) return { ok: false as const, reason: "password" as const };
  if (verifyPasswordCredential(input.newPassword, account.passwordCredential)) return { ok: false as const, reason: "samePassword" as const };
  await getDb().update(expertAccounts).set({ passwordCredential: createPasswordCredential(input.newPassword), updatedAt: new Date() })
    .where(eq(expertAccounts.expertId, account.expertId));
  return { ok: true as const };
}

export function normalizeNationalId(value: string) {
  return value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
export function isValidNationalId(value: string) { return /^\d{10}$/.test(value); }

function createPasswordCredential(password: string) {
  const salt = randomBytes(passwordSaltBytes);
  return `${salt.toString("hex")}.${scryptSync(password, salt, passwordKeyBytes).toString("hex")}`;
}
function verifyPasswordCredential(password: string, credential: string) {
  const [saltHex, digestHex] = credential.split(".");
  if (!saltHex || !digestHex || !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(digestHex)) return false;
  try {
    const expected = Buffer.from(digestHex, "hex");
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}
