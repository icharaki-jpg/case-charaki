import "server-only";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { verificationChallenges } from "../../db/schema";

const challengeLifetimeMs = 10 * 60 * 1000;
const maxAttempts = 6;

export type VerificationPurpose = "register" | "resetPassword";

export async function createVerificationChallenge(emailValue: string, purpose: VerificationPurpose) {
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + challengeLifetimeMs);
  const [challenge] = await getDb().insert(verificationChallenges).values({
    email: emailValue.trim().toLowerCase(),
    purpose,
    codeHash: hashCode(code),
    expiresAt,
  }).returning({
    id: verificationChallenges.id,
    expiresAt: verificationChallenges.expiresAt,
  });
  return { challengeId: challenge.id, challenge: { code, expiresAt: challenge.expiresAt.getTime() } };
}

export async function verifyVerificationChallenge(
  challengeId: string,
  emailValue: string,
  codeValue: string,
) {
  const [challenge] = await getDb().select().from(verificationChallenges)
    .where(eq(verificationChallenges.id, challengeId)).limit(1);
  if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
    return { ok: false as const, reason: "missing" as const };
  }
  if (challenge.email !== emailValue.trim().toLowerCase()) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (challenge.attempts >= maxAttempts) {
    await deleteVerificationChallenge(challengeId);
    return { ok: false as const, reason: "locked" as const };
  }

  const nextAttempts = challenge.attempts + 1;
  await getDb().update(verificationChallenges).set({ attempts: nextAttempts })
    .where(eq(verificationChallenges.id, challengeId));
  const expected = Buffer.from(challenge.codeHash, "hex");
  const actual = Buffer.from(hashCode(codeValue.trim()), "hex");
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    if (nextAttempts >= maxAttempts) await deleteVerificationChallenge(challengeId);
    return { ok: false as const, reason: "invalid" as const };
  }

  await deleteVerificationChallenge(challengeId);
  return { ok: true as const, purpose: challenge.purpose as VerificationPurpose, email: challenge.email };
}

export async function deleteVerificationChallenge(challengeId: string) {
  await getDb().delete(verificationChallenges).where(eq(verificationChallenges.id, challengeId));
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}
