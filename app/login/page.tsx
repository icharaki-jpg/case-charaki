"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasServerSession, loginExpert } from "../lib/experts";

export default function LoginPage() {
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState("/");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkExistingSession() {
      if (await hasServerSession()) {
        router.replace("/");
        return;
      }
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      setNextPath(params.get("next") || "/");
      if (params.get("registered") === "1") {
        setMessage("ثبت‌نام با موفقیت تأیید شد؛ اکنون با کد ملی و رمز عبور وارد شوید.");
      } else if (params.get("reset") === "1") {
        setMessage("رمز عبور با موفقیت تغییر کرد؛ اکنون با رمز جدید وارد شوید.");
      }
    }

    const timer = window.setTimeout(() => {
      void checkExistingSession();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await loginExpert(nationalId, password);
      router.replace(nextPath);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "ورود انجام نشد.");
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="auth-card content-card">
        <h1>ورود به سامانه</h1>
        <p className="muted">با کد ملی و رمز عبوری که هنگام ثبت‌نام تعیین کرده‌اید وارد شوید.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>کد ملی</span>
            <input
              type="text"
              value={nationalId}
              onChange={(event) => setNationalId(event.target.value.replace(/[^\d۰-۹]/g, "").slice(0, 10))}
              placeholder="مثلاً ۰۰۱۲۳۴۵۶۷۸"
              inputMode="numeric"
              maxLength={10}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span>رمز عبور</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="رمز عبور"
              required
              autoComplete="current-password"
            />
          </label>
          <div className="auth-forgot-link">
            <Link href={`/forgot-password?next=${encodeURIComponent(nextPath)}`} className="text-link">فراموشی رمز عبور</Link>
          </div>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}
          <button type="submit" className="button button-primary auth-submit">ورود به سامانه</button>
        </form>
        <p className="auth-bottom">حساب کاربری ندارید؟ <Link href="/experts/new" className="text-link">ثبت نام کارشناس</Link></p>
      </div>
    </div>
  );
}
