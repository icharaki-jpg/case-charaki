"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "./components/AuthGate";
import {
  fetchCasesFromDatabase,
  formatCaseParties,
  formatDate,
  getDelayDays,
  getDaysUntilDate,
  getEffectiveCaseStatus,
  toPersianDigits,
  type CaseRecord,
  type CaseStatus,
} from "./lib/cases";
import { getCurrentExpert, normalizeMeetingReminderDays } from "./lib/experts";

const statusItems: Array<{
  key: CaseStatus;
  label: string;
  tone: string;
  color: string;
}> = [
  { key: "new", label: "جدید", tone: "blue", color: "#4f8df7" },
  { key: "inProgress", label: "در حال بررسی", tone: "amber", color: "#e2a62b" },
  { key: "completed", label: "تکمیل‌شده", tone: "green", color: "#1ab394" },
  { key: "overdue", label: "عقب‌افتاده", tone: "red", color: "#ee5b68" },
];

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDays, setReminderDays] = useState(2);

  useEffect(() => {
    async function loadDashboardData() {
      const expert = getCurrentExpert();
      setReminderEnabled(expert?.meetingReminderEnabled ?? true);
      setReminderDays(normalizeMeetingReminderDays(expert?.meetingReminderDays));
      try {
        setCases(await fetchCasesFromDatabase());
      } catch {
        setCases([]);
      }
      setUnassignedCount(0);
    }

    const timer = window.setTimeout(() => void loadDashboardData(), 0);
    window.addEventListener("expert-auth-changed", loadDashboardData);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("expert-auth-changed", loadDashboardData);
    };
  }, []);

  function claimLegacyCases() {
    const expert = getCurrentExpert();
    if (!expert || !unassignedCount) return;
    const confirmed = window.confirm(
      `${toPersianDigits(unassignedCount)} پرونده قدیمی بدون مالک پیدا شد. آیا این پرونده‌ها به حساب «${expert.fullName}» منتقل شوند؟`,
    );
    if (!confirmed) return;

    setUnassignedCount(0);
  }

  const stats = useMemo(() => {
    const result = {
      total: cases.length,
      newCases: 0,
      active: 0,
      completed: 0,
      overdue: 0,
    };

    cases.forEach((item) => {
      const status = getEffectiveCaseStatus(item);
      if (status === "new") result.newCases += 1;
      if (status === "inProgress") result.active += 1;
      if (status === "completed") result.completed += 1;
      if (status === "overdue") result.overdue += 1;
    });

    return {
      ...result,
      completionRate: result.total ? Math.round((result.completed / result.total) * 100) : 0,
    };
  }, [cases]);

  const statusCounts = useMemo(() => {
    const result = {
      new: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    } satisfies Record<CaseStatus, number>;

    cases.forEach((item) => {
      result[getEffectiveCaseStatus(item)] += 1;
    });

    return result;
  }, [cases]);

  const overdueCases = useMemo(
    () =>
      cases
        .filter((item) => getEffectiveCaseStatus(item) === "overdue")
        .sort((first, second) => getDelayDays(second) - getDelayDays(first))
        .slice(0, 4),
    [cases],
  );

  const upcomingMeetingMatches = useMemo(() => {
    if (!reminderEnabled) return [];

    return cases
      .filter((item) => item.meetingDate && getEffectiveCaseStatus(item) !== "completed")
      .map((item) => ({ item, daysUntil: getDaysUntilDate(item.meetingDate) }))
      .filter(
        (entry): entry is { item: CaseRecord; daysUntil: number } =>
          entry.daysUntil !== undefined &&
          entry.daysUntil >= 0 &&
          entry.daysUntil <= reminderDays,
      )
      .sort(
        (first, second) =>
          first.daysUntil - second.daysUntil ||
          (first.item.meetingTime || "99:99").localeCompare(second.item.meetingTime || "99:99"),
      );
  }, [cases, reminderDays, reminderEnabled]);

  const upcomingMeetings = upcomingMeetingMatches.slice(0, 6);

  const maxStatusCount = Math.max(...Object.values(statusCounts), 1);
  const donutGradient = useMemo(() => buildDonutGradient(statusCounts), [statusCounts]);

  return (
    <AuthGate>
      <div className="page-shell dashboard-shell">
      <header className="dashboard-hero">
        <div>
          <p className="eyebrow dashboard-eyebrow">داشبورد مدیریتی</p>
          <h1>نمای کلی پرونده‌های کارشناسی</h1>
        </div>
      </header>

      {unassignedCount > 0 && (
        <section className="dashboard-legacy-notice" role="status">
          <div>
            <strong>{toPersianDigits(unassignedCount)} پرونده قدیمی بدون مالک</strong>
            <p>پرونده‌های نسخه قبلی هنوز به هیچ کارشناس متصل نیستند.</p>
          </div>
          <button type="button" className="button button-primary" onClick={claimLegacyCases}>
            انتقال به حساب من
          </button>
        </section>
      )}

      <section className="dashboard-chart-grid">
        <article className="dashboard-panel dashboard-bar-panel">
          <PanelHeading
            title="وضعیت پرونده‌ها"
            description="مقایسه تعداد پرونده‌ها بر اساس وضعیت فعلی"
            badge="نمای آماری"
          />

          <div className="dashboard-bar-chart" role="img" aria-label="نمودار تعداد پرونده‌ها بر اساس وضعیت">
            {statusItems.map((item) => {
              const count = statusCounts[item.key];
              const height = count ? Math.max((count / maxStatusCount) * 100, 12) : 4;

              return (
                <div className="dashboard-bar-item" key={item.key}>
                  <strong>{toPersianDigits(count)}</strong>
                  <div className="dashboard-bar-track">
                    <div
                      className={`dashboard-bar dashboard-bar-${item.tone}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="dashboard-panel dashboard-donut-panel">
          <PanelHeading
            title="توزیع وضعیت"
            description="سهم هر وضعیت از کل پرونده‌ها"
            badge="خلاصه"
          />

          <div className="dashboard-donut-layout">
            <div className="dashboard-donut" style={{ background: donutGradient }} role="img" aria-label="نمودار توزیع وضعیت پرونده‌ها">
              <div className="dashboard-donut-hole">
                <strong>{toPersianDigits(stats.total)}</strong>
                <span>پرونده</span>
              </div>
            </div>

            <div className="dashboard-legend">
              {statusItems.map((item) => (
                <div className="dashboard-legend-row" key={item.key}>
                  <span className="dashboard-legend-label">
                    <i style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <strong>{toPersianDigits(statusCounts[item.key])}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="dashboard-panel dashboard-attention-panel">
          <PanelHeading
            title="پرونده‌های نیازمند توجه"
            description="پرونده‌هایی که مهلت ارائه نظریه آن‌ها گذشته است"
            badge={overdueCases.length ? `${toPersianDigits(overdueCases.length)} مورد` : "وضعیت مطلوب"}
            badgeTone={overdueCases.length ? "danger" : "success"}
          />

          {overdueCases.length ? (
            <div className="dashboard-attention-list">
              {overdueCases.map((item) => (
                <Link href={`/cases/${item.id}`} className="dashboard-attention-item" key={item.id}>
                  <span className="dashboard-attention-icon">!</span>
                  <span className="dashboard-attention-copy">
                    <strong>{toPersianDigits(item.caseNumber)}</strong>
                    <small>{formatCaseParties(item)}</small>
                  </span>
                  <span className="dashboard-attention-delay">
                    {toPersianDigits(getDelayDays(item))} روز
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="dashboard-success-state">
              <span>✓</span>
              <div>
                <strong>پرونده عقب‌افتاده‌ای وجود ندارد</strong>
                <p>همه مهلت‌ها در وضعیت قابل پیگیری هستند.</p>
              </div>
            </div>
          )}
        </article>

        <article className="dashboard-panel dashboard-meeting-panel">
          <PanelHeading
            title="جلسه‌های نزدیک"
            description={
              reminderEnabled
                ? `جلسه‌های تا ${toPersianDigits(reminderDays)} روز آینده`
                : "یادآوری جلسه‌ها از پروفایل غیرفعال شده است"
            }
            badge={
              reminderEnabled
                ? upcomingMeetingMatches.length
                  ? `${toPersianDigits(upcomingMeetingMatches.length)} مورد`
                  : "موردی نیست"
                : "غیرفعال"
            }
            badgeTone={upcomingMeetingMatches.length ? "success" : "default"}
          />

          {!reminderEnabled ? (
            <div className="dashboard-success-state dashboard-meeting-empty">
              <span>✓</span>
              <div>
                <strong>یادآوری جلسه‌ها فعال نیست</strong>
                <p>از بخش پروفایل من، نمایش جلسه‌های نزدیک را فعال کنید.</p>
              </div>
            </div>
          ) : upcomingMeetings.length ? (
            <div className="dashboard-meeting-list">
              {upcomingMeetings.map(({ item, daysUntil }) => (
                <Link href={`/cases/${item.id}`} className="dashboard-meeting-item" key={item.id}>
                  <span className="dashboard-meeting-icon">⌚</span>
                  <span className="dashboard-meeting-copy">
                    <strong>{toPersianDigits(item.caseNumber)}</strong>
                    <small>{formatCaseParties(item)}</small>
                    <span>
                      {formatDate(item.meetingDate)}
                      {item.meetingTime ? ` - ${toPersianDigits(item.meetingTime)}` : ""}
                    </span>
                  </span>
                  <span className="dashboard-meeting-countdown">{formatMeetingCountdown(daysUntil)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="dashboard-success-state dashboard-meeting-empty">
              <span>✓</span>
              <div>
                <strong>جلسه نزدیکی وجود ندارد</strong>
                <p>در بازه تنظیم‌شده جلسه‌ای برای نمایش پیدا نشد.</p>
              </div>
            </div>
          )}
        </article>
      </section>
      </div>
    </AuthGate>
  );
}

function formatMeetingCountdown(daysUntil: number) {
  if (daysUntil === 0) return "امروز";
  if (daysUntil === 1) return "فردا";
  return `${toPersianDigits(daysUntil)} روز دیگر`;
}

function PanelHeading({
  title,
  description,
  badge,
  badgeTone = "default",
}: {
  title: string;
  description: string;
  badge?: string;
  badgeTone?: "default" | "danger" | "success";
}) {
  return (
    <div className="dashboard-panel-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {badge ? <span className={`dashboard-panel-badge dashboard-panel-badge-${badgeTone}`}>{badge}</span> : null}
    </div>
  );
}

function buildDonutGradient(counts: Record<CaseStatus, number>) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (!total) return "conic-gradient(#e7edf5 0 100%)";

  let cursor = 0;
  const segments = statusItems.map((item) => {
    const start = cursor;
    cursor += (counts[item.key] / total) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${segments.join(", ")})`;
}
