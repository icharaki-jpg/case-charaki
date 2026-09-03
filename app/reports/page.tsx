"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "../components/AuthGate";
import JalaliDatePicker from "../components/JalaliDatePicker";
import Pagination from "../components/Pagination";
import { formatCaseParties, formatDate, getCasesForExpert, getDelayDays, getEffectiveCaseStatus, toPersianDigits, type CaseRecord } from "../lib/cases";
import { getCurrentExpert } from "../lib/experts";

type StatusFilter = "all" | "completed" | "notCompleted" | CaseRecord["status"];
type ReportFilters = {
  query: string;
  status: StatusFilter;
  fromDate: string;
  toDate: string;
};

const emptyReportFilters: ReportFilters = {
  query: "",
  status: "all",
  fromDate: "",
  toDate: "",
};

const statusLabels: Record<CaseRecord["status"], string> = {
  new: "جدید",
  inProgress: "در حال بررسی",
  completed: "تکمیل‌شده",
  overdue: "عقب‌افتاده",
};
const pageSize = 10;

export default function ReportsPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [datePickerVersion, setDatePickerVersion] = useState(0);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(emptyReportFilters);
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const expert = getCurrentExpert();
      setCases(expert ? getCasesForExpert(expert.id) : []);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredCases = useMemo(() => {
    const normalizedQuery = appliedFilters.query.trim().toLowerCase();
    return cases.filter((item) => {
      const searchableText = [
        item.caseNumber,
        item.referralSource,
        item.claimant,
        item.claimantPhone,
        item.respondent,
        item.respondentPhone,
        item.claimantLawyer,
        item.claimantLawyerPhone,
        item.respondentLawyer,
        item.respondentLawyerPhone,
        item.description,
        item.meetingDate,
        item.meetingTime,
      ].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      const currentStatus = getEffectiveCaseStatus(item);
      const matchesStatus =
        appliedFilters.status === "all" ||
        (appliedFilters.status === "completed" && currentStatus === "completed") ||
        (appliedFilters.status === "notCompleted" && currentStatus !== "completed") ||
        currentStatus === appliedFilters.status;
      const matchesFromDate = !appliedFilters.fromDate || item.referralDate >= appliedFilters.fromDate;
      const matchesToDate = !appliedFilters.toDate || item.referralDate <= appliedFilters.toDate;
      return matchesQuery && matchesStatus && matchesFromDate && matchesToDate;
    });
  }, [appliedFilters, cases]);

  const summary = useMemo(() => ({
    total: filteredCases.length,
    completed: filteredCases.filter((item) => getEffectiveCaseStatus(item) === "completed").length,
    notCompleted: filteredCases.filter((item) => getEffectiveCaseStatus(item) !== "completed").length,
    overdue: filteredCases.filter((item) => getEffectiveCaseStatus(item) === "overdue").length,
  }), [filteredCases]);
  const pageCount = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setAppliedFilters(emptyReportFilters);
    setFilterError("");
    setDatePickerVersion((value) => value + 1);
    setPage(1);
  }

  function searchReports() {
    if (fromDate && toDate && fromDate > toDate) {
      setFilterError("تاریخ «از» نمی‌تواند بعد از تاریخ «تا» باشد.");
      return;
    }

    setFilterError("");
    setAppliedFilters({
      query: query.trim(),
      status,
      fromDate,
      toDate,
    });
    setPage(1);
  }

  return (
    <AuthGate>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">گزارش‌های مدیریتی</p>
            <h1>جست‌وجو و گزارش پرونده‌ها</h1>
            <p className="muted">پرونده‌های انجام‌شده، انجام‌نشده و موارد نیازمند پیگیری را پیدا کنید.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={() => window.print()}>چاپ گزارش</button>
        </div>

        <section className="content-card report-filter-card">
          <div className="section-heading">
            <div><h2>فیلتر گزارش</h2><p className="muted">در چند فیلد زیر جست‌وجو و فهرست نتیجه را محدود کنید.</p></div>
            <button type="button" className="text-button" onClick={clearFilters}>پاک کردن فیلترها</button>
          </div>
          <div className="report-filter-grid">
            <label className="report-search-field">
              <span>جست‌وجو در پرونده‌ها</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="شماره، مرجع یا نام طرفین..." />
            </label>
            <label className="report-search-field">
              <span>وضعیت پرونده</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                <option value="all">همه پرونده‌ها</option>
                <option value="completed">انجام‌شده</option>
                <option value="notCompleted">انجام‌نشده</option>
                <option value="new">جدید</option>
                <option value="inProgress">در حال بررسی</option>
                <option value="overdue">عقب‌افتاده</option>
              </select>
            </label>
            <JalaliDatePicker key={`from-${datePickerVersion}`} label="از تاریخ ارجاع" name="reportFromDate" onChange={setFromDate} />
            <JalaliDatePicker key={`to-${datePickerVersion}`} label="تا تاریخ ارجاع" name="reportToDate" onChange={setToDate} />
          </div>
          <div className="report-filter-actions">
            {filterError && <p className="form-error">{filterError}</p>}
            <button type="button" className="button button-primary" onClick={searchReports}>جست‌وجو</button>
          </div>
        </section>

        <section className="report-summary">
          <ReportStat label="نتایج پیدا‌شده" value={summary.total} tone="blue" />
          <ReportStat label="انجام‌شده" value={summary.completed} tone="green" />
          <ReportStat label="انجام‌نشده" value={summary.notCompleted} tone="amber" />
          <ReportStat label="عقب‌افتاده" value={summary.overdue} tone="red" />
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div><h2>نتیجه گزارش</h2><p className="muted">{toPersianDigits(summary.total)} مورد از {toPersianDigits(cases.length)} پرونده نمایش داده می‌شود.</p></div>
          </div>
          {filteredCases.length === 0 ? (
            <div className="empty-state report-empty"><div className="empty-icon">⌕</div><h3>پرونده‌ای با این فیلترها پیدا نشد</h3><p className="muted">عبارت جست‌وجو یا فیلترهای تاریخ و وضعیت را تغییر دهید.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>شماره پرونده</th><th>طرفین پرونده</th><th>تاریخ ارجاع</th><th>جلسه کارشناسی</th><th>مهلت نظریه</th><th>وضعیت</th><th>تأخیر</th><th /></tr></thead>
                <tbody>{visibleCases.map((item) => { const currentStatus = getEffectiveCaseStatus(item); const delayDays = getDelayDays(item); return <tr key={item.id}><td className="strong">{toPersianDigits(item.caseNumber)}</td><td>{formatCaseParties(item)}</td><td>{formatDate(item.referralDate)}</td><td>{formatMeeting(item)}</td><td>{formatDate(item.deadline)}</td><td><span className={`status status-${currentStatus}`}>{statusLabels[currentStatus]}</span></td><td>{delayDays > 0 ? <span className="delay-text">{toPersianDigits(delayDays)} روز</span> : "—"}</td><td><Link href={`/cases/${item.id}`} className="text-link">مشاهده</Link></td></tr>; })}</tbody>
              </table>
              <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
            </div>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

function ReportStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className={`report-stat report-stat-${tone}`}><span>{label}</span><strong>{toPersianDigits(value)}</strong></div>;
}

function formatMeeting(item: Pick<CaseRecord, "meetingDate" | "meetingTime">) {
  if (!item.meetingDate) return "تعیین نشده";
  return `${formatDate(item.meetingDate)}${item.meetingTime ? ` - ${toPersianDigits(item.meetingTime)}` : ""}`;
}
