import { formatDate, toLatinDigits } from "./cases";

export type ExpertStatus = "active" | "inactive";
export type ExpertVerificationStatus = "pending" | "verified";

export type ExpertRecord = {
  id: string;
  fullName: string;
  nationalId: string;
  phone: string;
  email: string;
  expertise: string;
  licenseNumber: string;
  membershipDate: string;
  address: string;
  notes: string;
  status: ExpertStatus;
  verificationStatus: ExpertVerificationStatus;
  createdAt: string;
  meetingReminderEnabled?: boolean;
  meetingReminderDays?: number;
};

export type ExpertProfileUpdate = Pick<
  ExpertRecord,
  | "fullName"
  | "phone"
  | "expertise"
  | "licenseNumber"
  | "address"
  | "notes"
  | "meetingReminderEnabled"
  | "meetingReminderDays"
>;

const storageKey = "registered-experts";
const verificationKey = "expert-verification";
const sessionKey = "expert-session";
const pendingPasswordKey = "expert-registration-password";
const verificationLifetime = 10 * 60 * 1000;

export type VerificationRequest = {
  email: string;
  expertId: string;
  purpose: "register";
  code: string;
  expiresAt: number;
  serverChallengeId?: string;
};

export type RegistrationRequest = VerificationRequest & {
  replacedExpert?: ExpertRecord;
  previousVerificationRequest?: VerificationRequest;
  previousPassword?: string;
};

export function getExperts(): ExpertRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(storageKey);
    const experts = value ? (JSON.parse(value) as Partial<ExpertRecord>[]) : [];
    return experts.map((expert) => ({
      ...expert,
      status: expert.status ?? "active",
      verificationStatus:
        expert.verificationStatus ?? (expert.status === "inactive" ? "pending" : "verified"),
      meetingReminderEnabled: expert.meetingReminderEnabled ?? true,
      meetingReminderDays: normalizeMeetingReminderDays(expert.meetingReminderDays),
    })) as ExpertRecord[];
  } catch {
    return [];
  }
}

function saveExperts(experts: ExpertRecord[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(experts));
}

export function addExpert(data: Omit<ExpertRecord, "id" | "createdAt" | "status">) {
  const expert: ExpertRecord = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "active",
    verificationStatus: "verified",
  };
  saveExperts([expert, ...getExperts()]);
  return expert;
}

export function registerExpert(data: Omit<ExpertRecord, "id" | "createdAt" | "status" | "verificationStatus">) {
  const experts = removeExpiredPendingExperts(getExperts());
  const email = data.email.trim().toLowerCase();
  const nationalId = normalizeNationalId(data.nationalId.trim());
  const verifiedEmailConflict = experts.find(
    (expert) =>
      expert.verificationStatus === "verified" &&
      expert.email.trim().toLowerCase() === email,
  );
  if (verifiedEmailConflict) {
    throw new Error("این ایمیل قبلاً ثبت شده است.");
  }
  const verifiedNationalIdConflict = experts.find(
    (expert) =>
      expert.verificationStatus === "verified" &&
      normalizeNationalId(expert.nationalId) === nationalId,
  );
  if (verifiedNationalIdConflict) {
    throw new Error("این کد ملی قبلاً ثبت شده است.");
  }

  const pendingConflicts = experts.filter(
    (expert) =>
      expert.verificationStatus === "pending" &&
      (expert.email.trim().toLowerCase() === email ||
        normalizeNationalId(expert.nationalId) === nationalId),
  );
  const storedRequest = getStoredVerificationRequest();
  const replacedExpert =
    pendingConflicts.find((expert) => expert.id === storedRequest?.expertId) ??
    pendingConflicts[0];
  const previousVerificationRequest =
    storedRequest?.expertId === replacedExpert?.id ? storedRequest : undefined;
  const previousPassword = replacedExpert
    ? getPendingRegistrationPassword(replacedExpert.email)
    : "";
  const expert: ExpertRecord = {
    ...data,
    email,
    nationalId,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "inactive",
    verificationStatus: "pending",
  };
  const pendingConflictIds = new Set(pendingConflicts.map((item) => item.id));
  saveExperts([expert, ...experts.filter((item) => !pendingConflictIds.has(item.id))]);
  const request = createVerificationRequest(email, expert.id);
  return {
    ...request,
    replacedExpert,
    previousVerificationRequest,
    previousPassword: previousPassword || undefined,
  } satisfies RegistrationRequest;
}

export function resendVerificationCode(emailValue: string) {
  const email = emailValue.trim().toLowerCase();
  const expert = getExperts().find((item) => item.email.toLowerCase() === email);
  if (!expert) throw new Error("درخواست ثبت‌نامی با این ایمیل پیدا نشد.");
  if (expert.verificationStatus === "verified") {
    throw new Error("این حساب قبلاً تأیید شده است؛ برای ورود از کد ملی و رمز عبور استفاده کنید.");
  }
  return createVerificationRequest(email, expert.id);
}

export function getVerificationRequest(emailValue: string) {
  if (typeof window === "undefined") return undefined;
  const email = emailValue.trim().toLowerCase();
  try {
    const value = window.localStorage.getItem(verificationKey);
    const request = value ? (JSON.parse(value) as VerificationRequest) : undefined;
    return request?.email === email ? request : undefined;
  } catch {
    return undefined;
  }
}

export function getCurrentExpert() {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(sessionKey);
    const session = value ? (JSON.parse(value) as { expertId?: string }) : undefined;
    return getExperts().find(
      (expert) => expert.id === session?.expertId && expert.verificationStatus === "verified",
    );
  } catch {
    return undefined;
  }
}

export function logoutExpert() {
  window.localStorage.removeItem(sessionKey);
  window.dispatchEvent(new Event("expert-auth-changed"));
}

export function updateExpertProfile(id: string, data: ExpertProfileUpdate) {
  const experts = getExperts();
  const expert = experts.find(
    (item) => item.id === id && item.verificationStatus === "verified",
  );
  if (!expert) {
    throw new Error("اطلاعات حساب کارشناس پیدا نشد.");
  }

  const updatedExpert = {
    ...expert,
    ...data,
    meetingReminderEnabled: data.meetingReminderEnabled ?? expert.meetingReminderEnabled ?? true,
    meetingReminderDays: normalizeMeetingReminderDays(
      data.meetingReminderDays ?? expert.meetingReminderDays,
    ),
  };
  saveExperts(experts.map((item) => (item.id === id ? updatedExpert : item)));
  window.dispatchEvent(new Event("expert-auth-changed"));
  return updatedExpert;
}

export function markExpertVerified(emailValue: string) {
  const email = emailValue.trim().toLowerCase();
  const experts = getExperts();
  const expert = experts.find((item) => item.email.toLowerCase() === email);
  if (!expert) throw new Error("اطلاعات کارشناس ثبت‌نام‌شده پیدا نشد.");

  const verifiedExpert = {
    ...expert,
    status: "active" as const,
    verificationStatus: "verified" as const,
  };
  saveExperts(experts.map((item) => (item.id === expert.id ? verifiedExpert : item)));
  window.localStorage.removeItem(verificationKey);
  clearPendingRegistrationPassword(email);
  window.dispatchEvent(new Event("expert-auth-changed"));
  return verifiedExpert;
}

export function markExpertSession(nationalIdValue: string) {
  const nationalId = normalizeNationalId(nationalIdValue);
  const experts = getExperts();
  const expert = experts.find(
    (item) => item.nationalId === nationalId && item.verificationStatus === "verified",
  );
  if (!expert) throw new Error("اطلاعات کارشناس تأییدشده پیدا نشد.");

  window.localStorage.setItem(
    sessionKey,
    JSON.stringify({ expertId: expert.id, loggedInAt: new Date().toISOString() }),
  );
  window.dispatchEvent(new Event("expert-auth-changed"));
  return expert;
}

export function savePendingRegistrationPassword(emailValue: string, password: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    pendingPasswordKey,
    JSON.stringify({
      email: emailValue.trim().toLowerCase(),
      password,
    }),
  );
}

export function getPendingRegistrationPassword(emailValue: string) {
  if (typeof window === "undefined") return "";
  try {
    const value = window.sessionStorage.getItem(pendingPasswordKey);
    const pending = value ? (JSON.parse(value) as { email?: string; password?: string }) : undefined;
    return pending?.email === emailValue.trim().toLowerCase() ? pending?.password ?? "" : "";
  } catch {
    return "";
  }
}

export function clearPendingRegistrationPassword(emailValue?: string) {
  if (typeof window === "undefined") return;
  if (!emailValue) {
    window.sessionStorage.removeItem(pendingPasswordKey);
    return;
  }

  const normalizedEmail = emailValue.trim().toLowerCase();
  try {
    const value = window.sessionStorage.getItem(pendingPasswordKey);
    const pending = value ? (JSON.parse(value) as { email?: string }) : undefined;
    if (pending?.email === normalizedEmail) {
      window.sessionStorage.removeItem(pendingPasswordKey);
    }
  } catch {
    window.sessionStorage.removeItem(pendingPasswordKey);
  }
}

export function rollbackExpertRegistration(request: RegistrationRequest) {
  const experts = getExperts().filter((expert) => expert.id !== request.expertId);
  if (request.replacedExpert) {
    experts.unshift(request.replacedExpert);
  }
  saveExperts(experts);
  window.localStorage.removeItem(verificationKey);
  clearPendingRegistrationPassword();

  if (request.previousVerificationRequest) {
    window.localStorage.setItem(
      verificationKey,
      JSON.stringify(request.previousVerificationRequest),
    );
  }
  if (request.replacedExpert && request.previousPassword) {
    savePendingRegistrationPassword(request.replacedExpert.email, request.previousPassword);
  }
}

export function cancelPendingRegistration(emailValue: string) {
  const request = getVerificationRequest(emailValue);
  if (!request) return;
  const experts = getExperts().filter((expert) => expert.id !== request.expertId);
  saveExperts(experts);
  window.localStorage.removeItem(verificationKey);
  clearPendingRegistrationPassword(emailValue);
}

export async function loginExpert(nationalIdValue: string, password: string) {
  const nationalId = normalizeNationalId(nationalIdValue);
  const expert = getExperts().find(
    (item) => item.nationalId === nationalId && item.verificationStatus === "verified",
  );
  if (!expert) {
    throw new Error("کارشناس تأییدشده‌ای با این کد ملی پیدا نشد.");
  }

  const response = await fetch("/api/auth/password-login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId, password }),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(body.error || "کد ملی یا رمز عبور نادرست است.");
  }

  markExpertSession(nationalId);
  return expert;
}

export async function requestPasswordResetCode(
  nationalIdValue: string,
  emailValue: string,
) {
  const nationalId = normalizeNationalId(nationalIdValue);
  const email = emailValue.trim().toLowerCase();
  const response = await fetch("/api/auth/password-reset/request", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nationalId, email }),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(body.error || "ارسال کد بازیابی رمز انجام نشد.");
  }
  if (!body.challengeId || typeof body.challengeId !== "string") {
    throw new Error("شناسه بازیابی رمز دریافت نشد.");
  }

  return {
    challengeId: body.challengeId,
    devCode: body.devCode || "",
    expiresAt: typeof body.expiresAt === "number" ? body.expiresAt : 0,
  };
}

export async function resetExpertPassword(input: {
  nationalId: string;
  email: string;
  challengeId: string;
  code: string;
  newPassword: string;
}) {
  const response = await fetch("/api/auth/password-reset/verify", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      nationalId: normalizeNationalId(input.nationalId),
      email: input.email.trim().toLowerCase(),
      code: toLatinDigits(input.code.trim()),
    }),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(body.error || "بازیابی رمز عبور انجام نشد.");
  }
}

export async function requestServerVerificationCode(emailValue: string) {
  const response = await fetch("/api/auth/challenge", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: emailValue.trim().toLowerCase(), purpose: "register" }),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(body.error || "ارسال کد تأیید انجام نشد.");
  }
  if (!body.challengeId || typeof body.challengeId !== "string") {
    throw new Error("شناسه چالش تأیید دریافت نشد.");
  }

  const request = getVerificationRequest(emailValue);
  if (!request) {
    throw new Error("درخواست محلی کد تأیید پیدا نشد.");
  }

  request.serverChallengeId = body.challengeId;
  request.code = body.devCode || "";
  request.expiresAt = typeof body.expiresAt === "number" ? body.expiresAt : request.expiresAt;
  window.localStorage.setItem(verificationKey, JSON.stringify(request));
  return request;
}

export async function verifyServerCode(emailValue: string, codeValue: string) {
  const request = getVerificationRequest(emailValue);
  if (!request?.serverChallengeId) {
    throw new Error("کد تأیید سروری آماده نیست. کد را دوباره درخواست کنید.");
  }
  const expert = getExperts().find((item) => item.id === request.expertId);
  const password = getPendingRegistrationPassword(emailValue);
  if (!expert || expert.verificationStatus !== "pending" || !password) {
    throw new Error("اطلاعات موقت ثبت‌نام پیدا نشد؛ لطفاً ثبت‌نام را دوباره انجام دهید.");
  }

  const response = await fetch("/api/auth/verify", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: emailValue.trim().toLowerCase(),
      challengeId: request.serverChallengeId,
      code: codeValue.trim(),
      nationalId: expert.nationalId,
      password,
    }),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    if (response.status === 409) {
      cancelPendingRegistration(emailValue);
    }
    throw new Error(body.error || "تأیید کد انجام نشد.");
  }
  return body;
}

export async function hasServerSession(emailValue?: string) {
  const response = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return false;
  const body = await readJsonResponse(response);
  if (!body.authenticated) return false;
  return !emailValue || body.email === emailValue.trim().toLowerCase();
}

export async function logoutServerSession() {
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  });
}

export async function changeExpertPassword(currentPassword: string, newPassword: string) {
  const response = await fetch("/api/auth/password-change", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(body.error || "تغییر رمز عبور انجام نشد.");
  }
}

export function removeExpert(id: string) {
  saveExperts(getExperts().filter((expert) => expert.id !== id));
}

export function normalizeMeetingReminderDays(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 2;
  return Math.min(30, Math.max(1, Math.round(value)));
}

export { formatDate };

function createVerificationRequest(
  email: string,
  expertId: string,
) {
  const request: VerificationRequest = {
    email,
    expertId,
    purpose: "register",
    code: "",
    expiresAt: Date.now() + verificationLifetime,
  };
  window.localStorage.setItem(verificationKey, JSON.stringify(request));
  console.info(`[توسعه] درخواست کد تأیید سروری برای ${email} ایجاد شد.`);
  return request;
}

function getStoredVerificationRequest() {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.localStorage.getItem(verificationKey);
    return value ? (JSON.parse(value) as VerificationRequest) : undefined;
  } catch {
    return undefined;
  }
}

function removeExpiredPendingExperts(experts: ExpertRecord[]) {
  const now = Date.now();
  const staleExperts = experts.filter(
    (expert) =>
      expert.verificationStatus === "pending" &&
      now - Date.parse(expert.createdAt) > verificationLifetime,
  );
  if (!staleExperts.length) return experts;

  const staleIds = new Set(staleExperts.map((expert) => expert.id));
  const request = getStoredVerificationRequest();
  const remaining = experts.filter((expert) => !staleIds.has(expert.id));
  saveExperts(remaining);

  if (request && staleIds.has(request.expertId)) {
    window.localStorage.removeItem(verificationKey);
    clearPendingRegistrationPassword(request.email);
  }
  return remaining;
}

function normalizeNationalId(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

async function readJsonResponse(response: Response) {
  try {
    return (await response.json()) as {
      error?: string;
      authenticated?: boolean;
      email?: string | null;
      challengeId?: string;
      devCode?: string;
      expiresAt?: number;
    };
  } catch {
    return {};
  }
}
