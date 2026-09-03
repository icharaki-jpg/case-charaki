"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthGate from "../../components/AuthGate";
import { deleteCaseFromDatabase, fetchCaseFromDatabase, formatAmount, formatDate, getDelayDays, getEffectiveCaseStatus, toPersianDigits, updateCaseInDatabase, type CaseRecord } from "../../lib/cases";
import { getCurrentExpert } from "../../lib/experts";

const labels: Record<CaseRecord["status"], string> = { new: "جدید", inProgress: "در حال بررسی", completed: "تکمیل‌شده", overdue: "عقب‌افتاده" };
export default function CaseDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<CaseRecord>();
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void fetchCaseFromDatabase(id).then(setItem).catch(() => setItem(undefined));
      },
      0,
    );
    return () => window.clearTimeout(timer);
  }, [id]);
  if (!item) return <AuthGate><div className="page-shell"><div className="content-card empty-state"><h2>پرونده پیدا نشد</h2><Link href="/cases" className="text-link">بازگشت به فهرست پرونده‌ها</Link></div></div></AuthGate>;
  const currentItem = item;
  const currentStatus = getEffectiveCaseStatus(item);
  const delayDays = getDelayDays(item);
  const expert = getCurrentExpert();
  function changeStatus(status: CaseRecord["status"]) {
    if (!expert) return;
    void updateCaseInDatabase(currentItem.id, { status }).then(setItem).catch(() => undefined);
  }
  function handleDelete() {
    if (expert && window.confirm("آیا از حذف این پرونده مطمئن هستید؟")) {
      void deleteCaseFromDatabase(currentItem.id).then(() => router.push("/cases"));
    }
  }
  return <AuthGate><div className="page-shell narrow"><div className="page-header"><div><p className="eyebrow">جزئیات پرونده</p><h1>{toPersianDigits(item.caseNumber)}</h1><p className="muted">{toPersianDigits(item.expertOrder)}</p></div><Link href="/cases" className="button button-secondary">بازگشت</Link></div>
    <section className="content-card detail-card"><div className="detail-top"><div><span className={`status status-${currentStatus}`}>{labels[currentStatus]}</span>{delayDays > 0 && <p className="delay-note">این پرونده {toPersianDigits(delayDays)} روز تأخیر دارد.</p>}</div><select value={currentStatus} onChange={(e) => changeStatus(e.target.value as CaseRecord["status"])} aria-label="تغییر وضعیت"><option value="new">جدید</option><option value="inProgress">در حال بررسی</option><option value="completed">تکمیل‌شده</option>{currentStatus === "overdue" && <option value="overdue">عقب‌افتاده (خودکار)</option>}</select></div><div className="detail-grid"><Info label="مرجع ارجاع‌دهنده" value={item.referralSource} /><Info label="تاریخ ارجاع" value={formatDate(item.referralDate)} /><Info label="تاریخ و ساعت جلسه کارشناسی" value={formatMeeting(item.meetingDate, item.meetingTime)} /><Info label="مهلت ارائه نظریه" value={formatDate(item.deadline)} /><Info label="مبلغ دستمزد علی‌الحساب" value={formatAmount(item.advanceFee)} /><Info label="تأخیر" value={delayDays > 0 ? `${toPersianDigits(delayDays)} روز` : "بدون تأخیر"} /><Info label="خواهان / شاکی" value={item.claimant} /><Info label="شماره تلفن خواهان / شاکی" value={item.claimantPhone} /><Info label="خوانده / مشتکی‌عنه" value={item.respondent} /><Info label="شماره تلفن خوانده / مشتکی‌عنه" value={item.respondentPhone} /><Info label="وکیل خواهان / شاکی" value={item.claimantLawyer} /><Info label="شماره تلفن وکیل خواهان / شاکی" value={item.claimantLawyerPhone} /><Info label="وکیل خوانده / مشتکی‌عنه" value={item.respondentLawyer} /><Info label="شماره تلفن وکیل خوانده / مشتکی‌عنه" value={item.respondentLawyerPhone} /><Info label="تاریخ ثبت" value={formatDate(item.createdAt.slice(0, 10))} /><Info label="قرار کارشناسی" value={item.expertOrder} wide /><Info label="توضیحات تکمیلی" value={item.description} wide /></div><div className="form-actions"><Link href={`/cases/${item.id}/edit`} className="button button-primary">ویرایش پرونده</Link><button className="button button-danger" onClick={handleDelete}>حذف پرونده</button></div></section>
  </div></AuthGate>;
}
function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "info info-wide" : "info"}><span>{label}</span><strong>{value ? toPersianDigits(value) : "—"}</strong></div>; }

function formatMeeting(meetingDate: string, meetingTime: string) {
  return [meetingDate ? formatDate(meetingDate) : "", meetingTime ? toPersianDigits(meetingTime) : ""].filter(Boolean).join(" - ");
}
