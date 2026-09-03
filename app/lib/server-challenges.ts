import "server-only";

import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const challengeLifetimeMs = 10 * 60 * 1000;
const maxAttempts = 6;

export type VerificationPurpose = "register" | "resetPassword";

type VerificationChallenge = {
  email: string;
  purpose: VerificationPurpose;
  code: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
};

type ChallengeStore = Map<string, VerificationChallenge>;

const runtimeState = globalThis as typeof globalThis & {
  __caseCharakiChallengeStore?: ChallengeStore;
};

const challenges = runtimeState.__caseCharakiChallengeStore ?? new Map<string, VerificationChallenge>();
runtimeState.__caseCharakiChallengeStore = challenges;

function removeExpiredChallenges(now = Date.now()) {
  for (const [challengeId, challenge] of challenges) {
    if (challenge.expiresAt <= now || challenge.attempts >= maxAttempts) {
      challenges.delete(challengeId);
    }
  }
}

export function createVerificationChallenge(emailValue: string, purpose: VerificationPurpose) {
  const now = Date.now();
  removeExpiredChallenges(now);

  const challengeId = randomBytes(24).toString("base64url");
  const code = String(randomInt(100000, 1000000));
  const challenge = {
    email: emailValue.trim().toLowerCase(),
    purpose,
    code,
    createdAt: now,
    expiresAt: now + challengeLifetimeMs,
    attempts: 0,
  };
  challenges.set(challengeId, challenge);
  return { challengeId, challenge };
}

export function verifyVerificationChallenge(
  challengeId: string,
  emailValue: string,
  codeValue: string,
) {
  removeExpiredChallenges();
  const challenge = challenges.get(challengeId);
  if (!challenge) return { ok: false as const, reason: "missing" as const };
  if (challenge.email !== emailValue.trim().toLowerCase()) {
    return { ok: false as const, reason: "invalid" as const };
  }
  if (challenge.attempts >= maxAttempts) {
    challenges.delete(challengeId);
    return { ok: false as const, reason: "locked" as const };
  }

  challenge.attempts += 1;
  const expected = Buffer.from(challenge.code, "utf8");
  const actual = Buffer.from(codeValue.trim(), "utf8");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!matches) {
    if (challenge.attempts >= maxAttempts) challenges.delete(challengeId);
    return { ok: false as const, reason: "invalid" as const };
  }

  challenges.delete(challengeId);
  return {
    ok: true as const,
    purpose: challenge.purpose,
    email: challenge.email,
  };
}
