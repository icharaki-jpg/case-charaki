"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate } from "../lib/cases";
import {
  getCurrentExpert,
  hasServerSession,
  logoutExpert,
  logoutServerSession,
  type ExpertRecord,
} from "../lib/experts";

type MenuIconName = "dashboard" | "new-case" | "cases" | "report";

function MenuIcon({ name }: { name: MenuIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  return (
    <svg
      aria-hidden="true"
      className="sidebar-menu-svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      {...common}
    >
      {name === "dashboard" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.2" />
          <rect x="14" y="3" width="7" height="7" rx="1.2" />
          <rect x="3" y="14" width="7" height="7" rx="1.2" />
          <rect x="14" y="14" width="7" height="7" rx="1.2" />
        </>
      )}
      {name === "new-case" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6M9 15h6" />
        </>
      )}
      {name === "cases" && (
        <>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M15 2v5h5M8 12h8M8 16h8M8 8h2" />
        </>
      )}
      {name === "report" && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6M8 18v-3M12 18v-6M16 18v-9" />
        </>
      )}
    </svg>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expert, setExpert] = useState<ExpertRecord>();
  const [systemDate, setSystemDate] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function syncAuth() {
      const currentExpert = getCurrentExpert();
      if (!currentExpert) {
        if (!cancelled) setExpert(undefined);
        return;
      }

      try {
        const sessionIsValid = await hasServerSession(currentExpert.email);
        if (!cancelled) {
          setExpert(sessionIsValid ? currentExpert : undefined);
        }
      } catch {
        if (!cancelled) setExpert(undefined);
      }
    }

    const timer = window.setTimeout(() => {
      void syncAuth();
    }, 0);
    window.addEventListener("expert-auth-changed", syncAuth);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("expert-auth-changed", syncAuth);
    };
  }, []);

  useEffect(() => {
    const updateSystemDate = () => {
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      setSystemDate(formatDate(dateKey));
    };

    updateSystemDate();
    const timer = window.setInterval(updateSystemDate, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const menuItems = [
    {
      title: "داشبورد",
      href: "/",
      requiresAuth: true,
    },
    {
      title: "ثبت پرونده",
      href: "/cases/new",
      requiresAuth: true,
    },
    {
      title: "پرونده‌های کارشناسی",
      href: "/cases",
      requiresAuth: true,
    },
    {
      title: "گزارش‌گیری",
      href: "/reports",
      requiresAuth: true,
    },
  ];

  async function handleLogout() {
    await logoutServerSession();
    logoutExpert();
    router.push("/");
  }

  return (
    <aside
      dir="rtl"
      className="app-sidebar fixed right-0 top-0 z-40 flex h-screen w-64 flex-col border-l border-slate-200 bg-blue-100"
    >
      <div className="border-b border-slate-300 px-5 py-5">
        <h2 className="text-lg font-bold text-slate-800">
          سامانه پرونده‌های کارشناسی
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          مدیریت و پیگیری پرونده‌ها
        </p>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {expert ? (
          <div className="sidebar-account">
            <Link
              href="/profile"
              aria-label="ویرایش پروفایل کارشناس"
              className={`sidebar-account-profile${pathname === "/profile" ? " sidebar-account-profile-active" : ""}`}
            >
              <div className="sidebar-account-avatar" title="گروه جهش">
                <Image src="/group-jahesh-logo.png" alt="لوگوی گروه جهش" width={38} height={38} priority />
              </div>
              <div className="sidebar-account-details">
                <strong>پروفایل من</strong>
                <span>{expert.fullName}</span>
              </div>
              <span className="sidebar-account-chevron" aria-hidden="true">‹</span>
            </Link>
            <button type="button" className="sidebar-account-logout" onClick={handleLogout}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10" />
                <path d="m14 8 4 4-4 4M18 12H9" />
              </svg>
              <span>خروج</span>
            </button>
          </div>
        ) : (
          <Link href="/login" className="sidebar-auth-link">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-200 text-base">♙</span>
            <span>ثبت نام / ورود کارشناس</span>
          </Link>
        )}

        {menuItems.map((item) => {
          const locked = item.requiresAuth && !expert;
          const isActive =
            Boolean(expert) &&
            (item.href === "/"
              ? pathname === "/"
              : item.href === "/cases"
                ? pathname === "/cases" ||
                  (pathname.startsWith("/cases/") && pathname !== "/cases/new")
                : item.href === "/reports"
                  ? pathname === "/reports"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`));
          const href = locked
            ? `/login?next=${encodeURIComponent(item.href)}`
            : item.href;

          return (
            <Link
              key={item.href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
                isActive
                  ? "bg-white font-bold text-blue-700 shadow-sm"
                  : locked
                    ? "text-slate-500 hover:bg-white/70"
                    : "text-slate-700 hover:bg-white/70"
              }`}
            >
              <span className={`sidebar-menu-icon${locked ? " sidebar-menu-icon-locked" : ""}`}>
                <MenuIcon
                  name={
                    item.href === "/"
                      ? "dashboard"
                      : item.href === "/cases/new"
                        ? "new-case"
                        : item.href === "/cases"
                          ? "cases"
                        : "report"
                  }
                />
              </span>

              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-300 p-4">
        <div className="sidebar-system-meta">
          <div>
            <span>تاریخ سیستم</span>
            <strong>{systemDate || "—"}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}
