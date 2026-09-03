export type CaseStatus = "new" | "inProgress" | "completed" | "overdue";

export type CaseRecord = {
  id: string;
  expertId?: string;
  caseNumber: string;
  referralSource: string;
  expertOrder: string;
  referralDate: string;
  meetingDate: string;
  meetingTime: string;
  deadline: string;
  advanceFee: string;
  claimant: string;
  claimantPhone: string;
  respondent: string;
  respondentPhone: string;
  claimantLawyer: string;
  claimantLawyerPhone: string;
  respondentLawyer: string;
  respondentLawyerPhone: string;
  description: string;
  status: CaseStatus;
  createdAt: string;
  firstParty?: string;
  secondParty?: string;
  subject?: string;
};

const storageKey = "expert-cases";

export function getCases(): CaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? normalizeCases(JSON.parse(value) as Partial<CaseRecord>[]) : [];
  } catch {
    return [];
  }
}

export function getCasesForExpert(expertId: string) {
  const normalizedExpertId = expertId.trim();
  if (!normalizedExpertId) return [];
  return getCases().filter((item) => item.expertId === normalizedExpertId);
}

export async function fetchCasesFromDatabase(): Promise<CaseRecord[]> {
  const response = await fetch("/api/cases", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("دریافت پرونده‌ها انجام نشد.");
  const body = (await response.json()) as { cases?: CaseRecord[] };
  return body.cases ?? [];
}

export async function fetchCaseFromDatabase(id: string): Promise<CaseRecord | undefined> {
  const response = await fetch(`/api/cases/${id}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error("دریافت پرونده انجام نشد.");
  const body = (await response.json()) as { case?: CaseRecord };
  return body.case;
}

export async function createCaseInDatabase(
  data: Omit<CaseRecord, "id" | "createdAt" | "status" | "expertId">,
) {
  const response = await fetch("/api/cases", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await response.json().catch(() => ({}))) as { case?: CaseRecord; error?: string };
  if (!response.ok || !body.case) throw new Error(body.error ?? "ثبت پرونده انجام نشد.");
  return body.case;
}

export async function updateCaseInDatabase(
  id: string,
  data: Partial<CaseRecord>,
) {
  const response = await fetch(`/api/cases/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await response.json().catch(() => ({}))) as { case?: CaseRecord; error?: string };
  if (!response.ok || !body.case) throw new Error(body.error ?? "ذخیره پرونده انجام نشد.");
  return body.case;
}

export async function deleteCaseFromDatabase(id: string) {
  const response = await fetch(`/api/cases/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "حذف پرونده انجام نشد.");
  }
}

export function getUnassignedCases() {
  return getCases().filter((item) => !item.expertId);
}

export function assignUnassignedCases(expertId: string) {
  const normalizedExpertId = expertId.trim();
  if (!normalizedExpertId) return [];

  const updated = getCases().map((item) =>
    item.expertId ? item : { ...item, expertId: normalizedExpertId },
  );
  saveCases(updated);
  return updated.filter((item) => item.expertId === normalizedExpertId);
}

export function getCaseForExpert(id: string, expertId: string) {
  return getCasesForExpert(expertId).find((item) => item.id === id);
}

function normalizeCases(cases: Partial<CaseRecord>[]) {
  return cases.map((item) => ({
    ...item,
    expertId: typeof item.expertId === "string" ? item.expertId.trim() || undefined : undefined,
    expertOrder: item.expertOrder ?? item.subject ?? "",
    meetingDate: item.meetingDate ?? "",
    meetingTime: item.meetingTime ?? "",
    advanceFee: item.advanceFee ?? "",
    claimant: item.claimant ?? item.firstParty ?? "",
    claimantPhone: item.claimantPhone ?? "",
    respondent: item.respondent ?? item.secondParty ?? "",
    respondentPhone: item.respondentPhone ?? "",
    claimantLawyer: item.claimantLawyer ?? "",
    claimantLawyerPhone: item.claimantLawyerPhone ?? "",
    respondentLawyer: item.respondentLawyer ?? "",
    respondentLawyerPhone: item.respondentLawyerPhone ?? "",
  })) as CaseRecord[];
}

function saveCases(cases: CaseRecord[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(cases));
}

export function addCase(
  data: Omit<CaseRecord, "id" | "createdAt" | "status" | "expertId">,
  expertId: string,
) {
  const item: CaseRecord = {
    ...data,
    expertId,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
  };
  saveCases([item, ...getCases()]);
  return item;
}

export function updateCase(
  id: string,
  data: Omit<CaseRecord, "id" | "createdAt" | "status" | "expertId">,
  expertId: string,
) {
  const updated = getCases().map((item) =>
    item.id === id && item.expertId === expertId ? { ...item, ...data } : item,
  );
  saveCases(updated);
  return updated.find((item) => item.id === id);
}

export function updateCaseStatus(id: string, status: CaseStatus, expertId: string) {
  saveCases(
    getCases().map((item) =>
      item.id === id && item.expertId === expertId ? { ...item, status } : item,
    ),
  );
}

export function formatCaseParties(item: Pick<CaseRecord, "claimant" | "respondent">) {
  return [item.claimant, item.respondent].filter(Boolean).join(" / ") || "—";
}

export function removeCase(id: string, expertId: string) {
  saveCases(getCases().filter((item) => item.id !== id || item.expertId !== expertId));
}

export function getEffectiveCaseStatus(item: CaseRecord): CaseStatus {
  if (item.status === "completed") return "completed";
  if (getDelayDays(item) > 0) return "overdue";
  if (item.status === "overdue" && item.deadline) return "inProgress";
  return item.status;
}

export function getDelayDays(item: CaseRecord) {
  if (!item.deadline || item.status === "completed") return 0;
  const deadline = dateKeyToUtc(item.deadline);
  const today = dateKeyToUtc(getTodayKey());
  if (deadline === undefined || today === undefined || today <= deadline) return 0;
  return Math.floor((today - deadline) / 86400000);
}

export function getDaysUntilDate(value: string) {
  if (!value) return undefined;
  const target = dateKeyToUtc(value);
  const today = dateKeyToUtc(getTodayKey());
  if (target === undefined || today === undefined) return undefined;
  return Math.floor((target - today) / 86400000);
}

export function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  const [jalaliYear, jalaliMonth, jalaliDay] = gregorianToJalali(year, month, day);
  return `${toPersianDigits(jalaliYear)}/${toPersianDigits(String(jalaliMonth).padStart(2, "0"))}/${toPersianDigits(String(jalaliDay).padStart(2, "0"))}`;
}

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function dateKeyToUtc(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return Date.UTC(year, month - 1, day);
}

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

export function toLatinDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)));
}

export function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (digit) => persianDigits[Number(digit)]);
}

export function normalizeAmount(value: string) {
  return toLatinDigits(value)
    .replace(/[\s,٬،]/g, "")
    .replace(/[^\d]/g, "");
}

export function formatAmount(value: string | undefined) {
  const normalized = normalizeAmount(value ?? "");
  if (!normalized) return "";
  return toPersianDigits(normalized.replace(/\B(?=(\d{3})+(?!\d))/g, "٬"));
}

export function jalaliToGregorian(value: string) {
  const parts = toLatinDigits(value).replace(/-/g, "/").split("/").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "";
  const [jy, jm, jd] = parts;
  if (jy < 1200 || jm < 1 || jm > 12 || jd < 1 || jd > (jm <= 6 ? 31 : jm <= 11 ? 30 : 30)) return "";
  const [gy, gm, gd] = jalaliToGregorianParts(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

export function jalaliToGregorianParts(jy: number, jm: number, jd: number) {
  const jy2 = jy - 979;
  let days = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4) + 78 + jd;
  days += jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186;
  let gy = 1600 + 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const gd = days + 1;
  const monthDays = [31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  let remaining = gd;
  while (remaining > monthDays[gm]) remaining -= monthDays[gm++];
  return [gy, gm + 1, remaining] as const;
}

export function gregorianToJalali(gy: number, gm: number, gd: number) {
  const gDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 355666 + 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + gDays[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd] as const;
}

export function jalaliMonthLength(year: number, month: number) {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  const [gy, gm, gd] = jalaliToGregorianParts(year, 12, 30);
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  return jy === year && jm === 12 && jd === 30 ? 30 : 29;
}
