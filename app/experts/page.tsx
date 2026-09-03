"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "../components/AuthGate";
import { formatDate, getExperts, removeExpert, type ExpertRecord } from "../lib/experts";

export default function ExpertsPage() {
  const [experts, setExperts] = useState<ExpertRecord[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setExperts(getExperts()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredExperts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return experts;
    return experts.filter((expert) =>
      [expert.fullName, expert.nationalId, expert.phone, expert.expertise, expert.licenseNumber]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [experts, query]);

  function handleDelete(expert: ExpertRecord) {
    if (!window.confirm(`آیا از حذف «${expert.fullName}» مطمئن هستید؟`)) return;
    removeExpert(expert.id);
    setExperts((current) => current.filter((item) => item.id !== expert.id));
  }

  return (
    <AuthGate><div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">مدیریت اعضای سامانه</p>
          <h1>کارشناسان</h1>
          <p className="muted">ثبت و مدیریت اطلاعات کارشناسان رسمی.</p>
        </div>
        <Link href="/experts/new" className="button button-primary">+ ثبت نام کارشناس</Link>
      </div>

      <section className="content-card">
        <div className="filters">
          <input
            aria-label="جست‌وجوی کارشناس"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو بر اساس نام، کد ملی، رشته یا شماره پروانه..."
          />
          <div className="filter-summary">{filteredExperts.length} کارشناس</div>
        </div>

        {filteredExperts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">♙</div>
            <h3>{experts.length ? "کارشناسی با این مشخصات پیدا نشد" : "هنوز کارشناسی ثبت نشده است"}</h3>
            <p className="muted">برای شروع، اطلاعات اولین کارشناس را ثبت کنید.</p>
            {!experts.length && <Link href="/experts/new" className="button button-primary">ثبت نام کارشناس</Link>}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>نام و نام خانوادگی</th><th>رشته کارشناسی</th><th>شماره پروانه</th><th>شماره تماس</th><th>تاریخ عضویت</th><th>وضعیت</th><th /></tr>
              </thead>
              <tbody>
                {filteredExperts.map((expert) => (
                  <tr key={expert.id}>
                    <td className="strong">{expert.fullName}</td>
                    <td>{expert.expertise}</td>
                    <td>{expert.licenseNumber || "—"}</td>
                    <td>{expert.phone}</td>
                    <td>{formatDate(expert.membershipDate)}</td>
                    <td><span className="status status-completed">فعال</span></td>
                    <td><button type="button" className="table-action danger-text" onClick={() => handleDelete(expert)}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div></AuthGate>
  );
}
