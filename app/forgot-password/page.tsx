"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toLatinDigits, toPersianDigits } from "../lib/cases";
import { requestPasswordResetCode, resetExpertPassword } from "../lib/experts";

type ResetRequest = {
  challengeId: string;
  devCode: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [nationalId, setNationalId] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [request, setRequest] = useState<ResetRequest>();
  const [nextPath, setNextPath] = useState("/");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setNextPath(params.get("next") || "/");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const normalizedNationalId = toLatinDigits(nationalId).replace(/\D/g, "");
    if (normalizedNationalId.length !== 10) {
      setError("کد ملی باید ۱۰ رقم باشد.");
      return;
    }
    if (!email.trim()) {
      setError("ایمیل ثبت‌شده را وارد کنید.");
      return;
    }

    try {
      const response = await requestPasswordResetCode(normalizedNationalId, email);
      setRequest({
        challengeId: response.challengeId,
        devCode: response.devCode,
      });
      setMessage("کد تأیید برای ایمیل ثبت‌شده ارسال شد. کد را وارد کنید.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "ارسال کد بازیابی انجام نشد.");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!request) {
      setError("ابتدا کد بازیابی را درخواست کنید.");
      return;
    }
    const normalizedCode = toLatinDigits(code).replace(/\D/g, "");
    if (normalizedCode.length !== 6) {
      setError("کد تأیید باید ۶ رقم باشد.");
      return;
    }
    if (newPassword.length < 8) {
      setError("رمز جدید باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setError("رمز جدید و تکرار آن یکسان نیست.");
      return;
    }

    try {
      await resetExpertPassword({
        nationalId,
        email,
        challengeId: request.challengeId,
        code: normalizedCode,
        newPassword,
      });
      router.replace(`/login?reset=1&next=${encodeURIComponent(nextPath)}`);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "بازیابی رمز عبور انجام نشد.");
    }
  }

  function editAccountInfo() {
    setRequest(undefined);
    setCode("");
    setNewPassword("");
    setPasswordConfirmation("");
    setError("");
    setMessage("");
  }

  return (
    <div className="page-shell auth-shell">
      <div className="auth-card content-card">
        <div className="auth-mark">⌕</div>
        <p className="eyebrow">بازیابی حساب کارشناس</p>
        <h1>فراموشی رمز عبور</h1>
        <p className="muted">
          {request
            ? "کد شش‌رقمی ارسال‌شده را وارد کنید و رمز جدید تعیین کنید."
            : "کد ملی و ایمیل ثبت‌شده را وارد کنید تا کد بازیابی برای شما ارسال شود."}
        </p>

        {!request ? (
          <form onSubmit={handleRequestCode} className="auth-form">
            <label className="field">
              <span>کد ملی</span>
              <input
                type="text"
                value={toPersianDigits(nationalId)}
                onChange={(event) => setNationalId(toLatinDigits(event.target.value).replace(/\D/g, "").slice(0, 10))}
                placeholder="مثلاً ۰۰۱۲۳۴۵۶۷۸"
                inputMode="numeric"
                maxLength={10}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span>پست الکترونیکی</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@email.com"
                autoComplete="email"
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            {message && <p className="form-success">{message}</p>}
            <button type="submit" className="button button-primary auth-submit">دریافت کد بازیابی</button>
          </form>
        ) : (
          <>
            <div className="email-badge">{email}</div>
            <form onSubmit={handleResetPassword} className="auth-form">
              <label className="field">
                <span>کد تأیید</span>
                <input
                  value={toPersianDigits(code)}
                  onChange={(event) => setCode(toLatinDigits(event.target.value).replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="مثلاً ۱۲۳۴۵۶"
                  maxLength={6}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span>رمز عبور جدید</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="حداقل ۸ کاراکتر"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label className="field">
                <span>تکرار رمز عبور جدید</span>
                <input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder="رمز جدید را دوباره وارد کنید"
                  autoComplete="new-password"
                  required
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              {message && <p className="form-success">{message}</p>}
              {request.devCode && (
                <div className="dev-code">
                  <span>کد آزمایشی محیط توسعه:</span>
                  <strong>{toPersianDigits(request.devCode)}</strong>
                </div>
              )}
              <button type="submit" className="button button-primary auth-submit">ذخیره رمز جدید</button>
            </form>
            <div className="auth-links">
              <button type="button" className="text-button" onClick={editAccountInfo}>ویرایش اطلاعات</button>
              <Link href="/login" className="text-link">بازگشت به ورود</Link>
            </div>
          </>
        )}

        {!request && (
          <p className="auth-bottom">
            رمز را به خاطر آوردید؟ <Link href="/login" className="text-link">بازگشت به ورود</Link>
          </p>
        )}
      </div>
    </div>
  );
}
