"use client";

import { useEffect, useMemo, useState } from "react";
import AuthGate from "../components/AuthGate";
import Pagination from "../components/Pagination";
import {
  caseFeeStatusLabels,
  fetchCaseFeesFromDatabase,
  formatAmount,
  normalizeAmount,
  updateCaseFeeInDatabase,
  type CaseFeeRecord,
  type CaseFeeStatus,
} from "../lib/case-fees";
import { formatCaseParties, toPersianDigits } from "../lib/cases";

const pageSize = 10;

export default function CaseFeesPage() {
  const [fees, setFees] = useState<CaseFeeRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | CaseFeeStatus>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCaseFeesFromDatabase()
        .then(setFees)
        .catch((loadError) => {
          setError(loadError instanceof Error ? loadError.message : "دریافت دستمزدها انجام نشد.");
          setFees([]);
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredFees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return fees.filter((item) => {
      const searchableText = [
        item.caseNumber,
        item.claimant,
        item.respondent,
        formatCaseParties(item),
        caseFeeStatusLabels[item.status],
      ].join(" ").toLowerCase();
      return (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
        (status === "all" || item.status === status);
    });
  }, [fees, query, status]);

  const pageCount = Math.max(1, Math.ceil(filteredFees.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleFees = filteredFees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function changeStatus(value: "all" | CaseFeeStatus) {
    setStatus(value);
    setPage(1);
  }

  return (
    <AuthGate>
      <div className="page-shell">
        <div className="page-header">
          <div>
            <p className="eyebrow">مدیریت مالی پرونده‌ها</p>
            <h1>دستمزد کارشناسی</h1>
            <p className="muted">پیگیری مبلغ علی‌الحساب، تفاوت دستمزد و وضعیت وصول هر پرونده.</p>
          </div>
        </div>

        <section className="content-card case-fees-card">
          <div className="filters case-fees-filters">
            <input
              aria-label="جست‌وجوی دستمزد کارشناسی"
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="جست‌وجو بر اساس شماره پرونده یا نام طرفین..."
            />
            <select aria-label="فیلتر وضعیت دستمزد" value={status} onChange={(event) => changeStatus(event.target.value as "all" | CaseFeeStatus)}>
              <option value="all">همه وضعیت‌ها</option>
              <option value="sendToCenter">ارسال به کانون یا مرکز</option>
              <option value="followUp">پیگیری جهت وصول</option>
              <option value="collected">وصول شده</option>
            </select>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading ? (
            <div className="loading-state">در حال دریافت اطلاعات دستمزد...</div>
          ) : filteredFees.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">₽</div>
              <h3>{fees.length ? "پرونده‌ای با این فیلتر پیدا نشد" : "پرونده دارای مبلغ علی‌الحساب پیدا نشد"}</h3>
              <p className="muted">برای نمایش در این بخش، هنگام ثبت پرونده مبلغ علی‌الحساب را وارد کنید.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="case-fees-table">
                  <thead>
                    <tr>
                      <th>شماره پرونده</th>
                      <th>طرفین پرونده</th>
                      <th>مبلغ علی‌الحساب</th>
                      <th>تفاوت دستمزد</th>
                      <th>وضعیت</th>
                      <th>ثبت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFees.map((item) => <FeeRow key={item.caseId} item={item} onSaved={(updated) => {
                      setFees((current) => current.map((fee) => fee.caseId === item.caseId ? { ...fee, ...updated } : fee));
                    }} />)}
                  </tbody>
                </table>
              </div>
              <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} />
            </>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

function FeeRow({ item, onSaved }: { item: CaseFeeRecord; onSaved: (updated: Partial<CaseFeeRecord>) => void }) {
  const [differenceFee, setDifferenceFee] = useState(formatAmount(item.differenceFee));
  const [status, setStatus] = useState<CaseFeeStatus>(item.status);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateCaseFeeInDatabase(item.caseId, { differenceFee: normalizeAmount(differenceFee), status });
      onSaved({ differenceFee: updated.differenceFee ?? normalizeAmount(differenceFee), status: (updated.status as CaseFeeStatus) ?? status });
      setMessage("ذخیره شد");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "ذخیره نشد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td className="strong">{toPersianDigits(item.caseNumber)}</td>
      <td>{formatCaseParties(item)}</td>
      <td className="fee-amount">{formatAmount(item.advanceFee)} تومان</td>
      <td>
        <input
          className="case-fee-difference-input"
          value={differenceFee}
          onChange={(event) => setDifferenceFee(formatAmount(event.target.value))}
          placeholder="اختیاری"
          inputMode="numeric"
          aria-label={`تفاوت دستمزد پرونده ${item.caseNumber}`}
        />
      </td>
      <td>
        <select className="case-fee-status-select" value={status} onChange={(event) => setStatus(event.target.value as CaseFeeStatus)} aria-label={`وضعیت دستمزد پرونده ${item.caseNumber}`}>
          <option value="sendToCenter">ارسال به کانون یا مرکز</option>
          <option value="followUp">پیگیری جهت وصول</option>
          <option value="collected">وصول شده</option>
        </select>
      </td>
      <td>
        <button type="button" className="button button-primary case-fee-save" onClick={() => void save()} disabled={saving}>
          {saving ? "در حال ذخیره..." : "ثبت"}
        </button>
        {message && <small className={`case-fee-message${message === "ذخیره شد" ? " success" : ""}`}>{message}</small>}
      </td>
    </tr>
  );
}
