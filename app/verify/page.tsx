"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getVerificationRequest,
  markExpertVerified,
  requestServerVerificationCode,
  resendVerificationCode,
  verifyServerCode,
} from "../lib/experts";

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [nextPath, setNextPath] = useState("/");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setEmail(params.get("email") ?? "");
      setNextPath(params.get("next") || "/");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const request = refresh >= 0 ? getVerificationRequest(email) : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await verifyServerCode(email, code);
      markExpertVerified(email);
      router.replace(`/login?registered=1&next=${encodeURIComponent(nextPath)}`);
    } catch (verificationError) {
      setError(verificationError instanceof Error ? verificationError.message : "تأیید انجام نشد.");
    }
  }

  async function handleResend() {
    setError("");
    setMessage("");
    try {
      const request = resendVerificationCode(email);
      await requestServerVerificationCode(request.email);
      setCode("");
      setRefresh((value) => value + 1);
      setMessage("کد جدید تولید شد. پس از اتصال سرویس ایمیل، همین کد برای کاربر ارسال خواهد شد.");
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "ارسال مجدد کد انجام نشد.");
    }
  }

  return (
    <div className="page-shell auth-shell">
      <div className="auth-card content-card">
        <div className="auth-mark">✉</div>
        <p className="eyebrow">تأیید حساب کارشناس</p>
        <h1>تأیید ثبت‌نام کارشناس</h1>
        <p className="muted">کد شش‌رقمی ارسال‌شده به ایمیل زیر را وارد کنید.</p>
        <div className="email-badge">{email || "ایمیل ثبت‌نام‌شده"}</div>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>کد تأیید</span>
            <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="مثلاً ۱۲۳۴۵۶" maxLength={6} required autoFocus />
          </label>
          {error && <p className="form-error">{error}</p>}
          {message && <p className="form-success">{message}</p>}
          {request?.code && (
            <div className="dev-code">
              <span>کد آزمایشی محیط توسعه:</span>
              <strong>{request.code}</strong>
            </div>
          )}
          <button type="submit" className="button button-primary auth-submit">تأیید ثبت‌نام</button>
        </form>
        <div className="auth-links">
          <button type="button" className="text-button" onClick={handleResend}>ارسال مجدد کد</button>
          <Link href="/login" className="text-link">بازگشت به ورود</Link>
        </div>
      </div>
    </div>
  );
}
