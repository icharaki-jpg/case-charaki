"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import JalaliDatePicker from "../../components/JalaliDatePicker";
import { toLatinDigits } from "../../lib/cases";
import {
  registerExpert,
  rollbackExpertRegistration,
  requestServerVerificationCode,
  savePendingRegistrationPassword,
} from "../../lib/experts";

export default function NewExpertPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const nationalId = toLatinDigits(data.nationalId ?? "").replace(/\D/g, "");

    if (nationalId.length !== 10) {
      setError("کد ملی باید ۱۰ رقم باشد.");
      return;
    }
    if (!data.email?.trim()) {
      setError("ایمیل برای دریافت کد تأیید الزامی است.");
      return;
    }
    if (!data.password || data.password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (data.password !== data.passwordConfirmation) {
      setError("رمز عبور و تکرار آن یکسان نیست.");
      return;
    }
    try {
      const request = registerExpert({
        fullName: data.fullName,
        nationalId,
        phone: data.phone,
        email: data.email,
        expertise: data.expertise,
        licenseNumber: data.licenseNumber ?? "",
        membershipDate: data.membershipDate || new Date().toISOString().slice(0, 10),
        address: data.address ?? "",
        notes: data.notes ?? "",
      });
      savePendingRegistrationPassword(request.email, data.password);
      try {
        await requestServerVerificationCode(request.email);
      } catch (challengeError) {
        rollbackExpertRegistration(request);
        throw challengeError;
      }
      router.push(`/verify?email=${encodeURIComponent(request.email)}&mode=register`);
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : "ثبت‌نام انجام نشد.");
    }
  }

  return (
    <div className="page-shell narrow">
      <div className="page-header">
        <div>
          <p className="eyebrow">مدیریت کارشناسان</p>
          <h1>ثبت نام کارشناس</h1>
          <p className="muted">اطلاعات کارشناس را وارد کنید؛ سپس وارد مرحله تأیید ایمیل می‌شوید.</p>
        </div>
        <button type="button" className="button button-secondary" onClick={() => router.push("/experts")}>بازگشت</button>
      </div>

      <form onSubmit={handleSubmit} className="content-card form-card">
        <div className="form-section-title">
          <h2>اطلاعات هویتی و حرفه‌ای</h2>
          <p className="muted">پس از ثبت اطلاعات، کد تأیید به ایمیل شما ارسال می‌شود.</p>
        </div>
        <div className="form-grid">
          <Field label="نام و نام خانوادگی" name="fullName" placeholder="مثلاً علی رضایی" required />
          <Field label="کد ملی" name="nationalId" placeholder="مثلاً ۰۰۱۲۳۴۵۶۷۸" inputMode="numeric" maxLength={10} required />
          <Field label="شماره تماس" name="phone" placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷" type="tel" inputMode="tel" maxLength={11} required />
          <Field label="پست الکترونیکی" name="email" placeholder="example@email.com" type="email" required />
          <Field label="رشته و صلاحیت کارشناسی" name="expertise" placeholder="مثلاً امور ثبتی و اراضی" required />
          <Field label="شماره پروانه کارشناسی" name="licenseNumber" placeholder="شماره پروانه" />
          <Field label="رمز عبور" name="password" placeholder="حداقل ۸ کاراکتر" type="password" required />
          <Field label="تکرار رمز عبور" name="passwordConfirmation" placeholder="رمز عبور را دوباره وارد کنید" type="password" required />
          <JalaliDatePicker label="تاریخ عضویت" name="membershipDate" />
          <Field label="نشانی" name="address" placeholder="نشانی محل کار یا سکونت" />
          <Field label="توضیحات" name="notes" placeholder="توضیحات تکمیلی" wide textarea />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-secondary" onClick={() => router.push("/experts")}>انصراف</button>
          <button type="submit" className="button button-primary">ثبت اطلاعات کارشناس</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, name, placeholder, type = "text", required = false, wide = false, textarea = false, inputMode, maxLength }: { label: string; name: string; placeholder?: string; type?: string; required?: boolean; wide?: boolean; textarea?: boolean; inputMode?: "numeric" | "text" | "tel" | "email"; maxLength?: number }) {
  return (
    <label className={wide ? "field field-wide" : "field"}>
      <span>{label}{required && <em> *</em>}</span>
      {textarea ? <textarea name={name} required={required} placeholder={placeholder} rows={4} /> : <input name={name} type={type} required={required} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} />}
    </label>
  );
}
