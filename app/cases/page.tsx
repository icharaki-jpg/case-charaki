"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "../components/AuthGate";
import Pagination from "../components/Pagination";
import { formatCaseParties, formatDate, getCasesForExpert, getDelayDays, getEffectiveCaseStatus, toPersianDigits, type CaseRecord } from "../lib/cases";
import { getCurrentExpert } from "../lib/experts";

const labels: Record<CaseRecord["status"], string> = { new: "جدید", inProgress: "در حال بررسی", completed: "تکمیل‌شده", overdue: "عقب‌افتاده" };
const pageSize = 10;

export default function CasesPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const expert = getCurrentExpert();
      setCases(expert ? getCasesForExpert(expert.id) : []);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const filtered = useMemo(() => cases.filter((item) => {
    const text = [item.caseNumber, item.referralSource, item.claimant, item.claimantPhone, item.respondent, item.respondentPhone, item.claimantLawyer, item.claimantLawyerPhone, item.respondentLawyer, item.respondentLawyerPhone].join(" ").toLowerCase();
    return text.includes(query.toLowerCase()) && (status === "all" || getEffectiveCaseStatus(item) === status);
  }), [cases, query, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleCases = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  return <AuthGate><div className="page-shell">
    <div className="page-header"><div><p className="eyebrow">مدیریت پرونده‌ها</p><h1>پرونده‌های کارشناسی</h1><p className="muted">جست‌وجو، پیگیری و مشاهده جزئیات پرونده‌ها.</p></div><Link href="/cases/new" className="button button-primary">+ ثبت پرونده جدید</Link></div>
    <section className="content-card">
      <div className="filters"><input aria-label="جست‌وجو" value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="جست‌وجو در شماره، مرجع یا طرفین..." /><select aria-label="فیلتر وضعیت" value={status} onChange={(e) => handleStatusChange(e.target.value)}><option value="all">همه وضعیت‌ها</option><option value="new">جدید</option><option value="inProgress">در حال بررسی</option><option value="completed">تکمیل‌شده</option><option value="overdue">عقب‌افتاده</option></select></div>
      {filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">⌕</div><h3>{cases.length ? "پرونده‌ای با این مشخصات پیدا نشد" : "هنوز پرونده‌ای ثبت نشده است"}</h3><p className="muted">عبارت جست‌وجو یا فیلتر را تغییر دهید، یا یک پرونده جدید ثبت کنید.</p></div> : <><div className="table-wrap"><table><thead><tr><th>شماره پرونده</th><th>طرفین پرونده</th><th>تاریخ ارجاع</th><th>مهلت ارائه نظر</th><th>وضعیت</th><th>تأخیر</th><th /></tr></thead><tbody>{visibleCases.map((item) => { const currentStatus = getEffectiveCaseStatus(item); const delayDays = getDelayDays(item); return <tr key={item.id}><td className="strong">{toPersianDigits(item.caseNumber)}</td><td>{formatCaseParties(item)}</td><td>{formatDate(item.referralDate)}</td><td>{formatDate(item.deadline)}</td><td><span className={`status status-${currentStatus}`}>{labels[currentStatus]}</span></td><td>{delayDays > 0 ? <span className="delay-text">{toPersianDigits(delayDays)} روز</span> : "—"}</td><td><Link href={`/cases/${item.id}`} className="text-link">مشاهده</Link></td></tr>; })}</tbody></table></div><Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} /></>}
    </section>
  </div></AuthGate>;
}
