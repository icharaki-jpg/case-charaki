import { formatAmount, normalizeAmount } from "./cases";

export type CaseFeeStatus = "sendToCenter" | "followUp" | "collected";

export type CaseFeeRecord = {
  caseId: string;
  caseNumber: string;
  claimant: string;
  respondent: string;
  advanceFee: string;
  feeId?: string;
  differenceFee: string;
  status: CaseFeeStatus;
  updatedAt?: string | null;
};

export const caseFeeStatusLabels: Record<CaseFeeStatus, string> = {
  sendToCenter: "ارسال به کانون یا مرکز",
  followUp: "پیگیری جهت وصول",
  collected: "وصول شده",
};

export async function fetchCaseFeesFromDatabase(): Promise<CaseFeeRecord[]> {
  const response = await fetch("/api/case-fees", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("دریافت دستمزدهای کارشناسی انجام نشد.");
  const body = (await response.json()) as { fees?: CaseFeeRecord[] };
  return body.fees ?? [];
}

export async function updateCaseFeeInDatabase(
  caseId: string,
  data: { differenceFee: string; status: CaseFeeStatus },
) {
  const response = await fetch(`/api/case-fees/${caseId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      differenceFee: normalizeAmount(data.differenceFee),
      status: data.status,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { fee?: Partial<CaseFeeRecord>; error?: string };
  if (!response.ok || !body.fee) throw new Error(body.error ?? "ذخیره دستمزد کارشناسی انجام نشد.");
  return body.fee;
}

export { formatAmount, normalizeAmount };
