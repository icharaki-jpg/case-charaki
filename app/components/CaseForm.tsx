"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import JalaliDatePicker from "./JalaliDatePicker";
import { createCaseInDatabase, formatAmount, normalizeAmount, toLatinDigits, toPersianDigits, updateCaseInDatabase, type CaseRecord } from "../lib/cases";

type CaseFormData = Pick<
  CaseRecord,
  | "caseNumber"
  | "referralSource"
  | "expertOrder"
  | "referralDate"
  | "meetingDate"
  | "meetingTime"
  | "deadline"
  | "advanceFee"
  | "claimant"
  | "claimantPhone"
  | "respondent"
  | "respondentPhone"
  | "claimantLawyer"
  | "claimantLawyerPhone"
  | "respondentLawyer"
  | "respondentLawyerPhone"
  | "description"
>;

const phoneFields = [
  "claimantPhone",
  "respondentPhone",
  "claimantLawyerPhone",
  "respondentLawyerPhone",
] as const;

export default function CaseForm({ initialCase, submitLabel = "ثبت پرونده" }: { initialCase?: CaseRecord; submitLabel?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const caseNumber = toLatinDigits(data.caseNumber?.trim() ?? "");

    if (!/^\d{7}$/.test(caseNumber)) {
      setError("شماره پرونده باید دقیقاً ۷ رقم و فقط شامل عدد باشد.");
      return;
    }
    if (!data.referralDate || !data.deadline) {
      setError("تاریخ‌ها را از تقویم انتخاب کنید یا با قالب شمسی ۱۴۰۵/۰۵/۲۸ وارد کنید.");
      return;
    }
    if (!data.referralSource?.trim() || !data.expertOrder?.trim() || !data.claimant?.trim() || !data.respondent?.trim()) {
      setError("لطفاً همه‌ی فیلدهای ضروری پرونده را تکمیل کنید.");
      return;
    }
    if (data.deadline < data.referralDate) {
      setError("مهلت ارائه نظر نمی‌تواند قبل از تاریخ ارجاع باشد.");
      return;
    }
    const meetingTime = normalizeMeetingTime(data.meetingTime ?? "");
    if ((data.meetingDate && !meetingTime) || (!data.meetingDate && meetingTime)) {
      setError("برای جلسه کارشناسی، تاریخ و ساعت را هر دو وارد کنید یا هر دو را خالی بگذارید.");
      return;
    }

    for (const fieldName of phoneFields) {
      const phone = normalizePhone(data[fieldName] ?? "");
      if (phone && !/^09\d{9}$/.test(phone)) {
        setError("شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.");
        return;
      }
      data[fieldName] = phone;
    }

    const formData: CaseFormData = {
      caseNumber,
      referralSource: data.referralSource,
      expertOrder: data.expertOrder,
      referralDate: data.referralDate,
      meetingDate: data.meetingDate ?? "",
      meetingTime,
      deadline: data.deadline,
      advanceFee: normalizeAmount(data.advanceFee ?? ""),
      claimant: data.claimant,
      claimantPhone: data.claimantPhone,
      respondent: data.respondent,
      respondentPhone: data.respondentPhone,
      claimantLawyer: data.claimantLawyer ?? "",
      claimantLawyerPhone: data.claimantLawyerPhone ?? "",
      respondentLawyer: data.respondentLawyer ?? "",
      respondentLawyerPhone: data.respondentLawyerPhone ?? "",
      description: data.description ?? "",
    };

    try {
      setSaving(true);
      const saved = initialCase
        ? await updateCaseInDatabase(initialCase.id, formData)
        : await createCaseInDatabase(formData);
      router.push(`/cases/${saved.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "ذخیره پرونده انجام نشد.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="content-card form-card">
      <div className="form-grid">
        <Field label="شماره پرونده" name="caseNumber" placeholder="شماره بایگانی ۷ رقمی" defaultValue={toPersianDigits(initialCase?.caseNumber ?? "")} inputMode="numeric" maxLength={7} pattern="[0-9۰-۹]{7}" required numeric />
        <Field label="مرجع ارجاع‌دهنده" name="referralSource" placeholder="مثلاً شعبه دوم دادگاه حقوقی" defaultValue={initialCase?.referralSource} required />
        <Field label="قرار کارشناسی" name="expertOrder" placeholder="متن یا شرح قرار کارشناسی" defaultValue={initialCase?.expertOrder} required wide textarea />
        <JalaliDatePicker label="تاریخ ارجاع" name="referralDate" initialValue={initialCase?.referralDate} required />
        <JalaliDatePicker label="تاریخ جلسه کارشناسی" name="meetingDate" initialValue={initialCase?.meetingDate} />
        <Field label="ساعت جلسه کارشناسی" name="meetingTime" placeholder="مثلاً ۰۸:۳۰" defaultValue={formatTimeInput(initialCase?.meetingTime)} inputMode="numeric" maxLength={5} time />
        <JalaliDatePicker label="مهلت ارائه نظریه" name="deadline" initialValue={initialCase?.deadline} required />
        <Field label="خواهان / شاکی" name="claimant" placeholder="نام خواهان یا شاکی" defaultValue={initialCase?.claimant} required />
        <Field label="شماره تلفن خواهان / شاکی" name="claimantPhone" placeholder="اختیاری؛ مانند ۰۹۱۲۱۲۳۴۵۶۷" defaultValue={toPersianDigits(initialCase?.claimantPhone ?? "")} type="tel" inputMode="tel" maxLength={11} numeric />
        <Field label="خوانده / مشتکی‌عنه" name="respondent" placeholder="نام خوانده یا مشتکی‌عنه" defaultValue={initialCase?.respondent} required />
        <Field label="شماره تلفن خوانده / مشتکی‌عنه" name="respondentPhone" placeholder="اختیاری؛ مانند ۰۹۱۲۱۲۳۴۵۶۷" defaultValue={toPersianDigits(initialCase?.respondentPhone ?? "")} type="tel" inputMode="tel" maxLength={11} numeric />
        <Field label="وکیل خواهان / شاکی" name="claimantLawyer" placeholder="در صورت وجود" defaultValue={initialCase?.claimantLawyer} />
        <Field label="شماره تلفن وکیل خواهان / شاکی" name="claimantLawyerPhone" placeholder="اختیاری؛ مانند ۰۹۱۲۱۲۳۴۵۶۷" defaultValue={toPersianDigits(initialCase?.claimantLawyerPhone ?? "")} type="tel" inputMode="tel" maxLength={11} numeric />
        <Field label="وکیل خوانده / مشتکی‌عنه" name="respondentLawyer" placeholder="در صورت وجود" defaultValue={initialCase?.respondentLawyer} />
        <Field label="شماره تلفن وکیل خوانده / مشتکی‌عنه" name="respondentLawyerPhone" placeholder="اختیاری؛ مانند ۰۹۱۲۱۲۳۴۵۶۷" defaultValue={toPersianDigits(initialCase?.respondentLawyerPhone ?? "")} type="tel" inputMode="tel" maxLength={11} numeric />
        <Field label="توضیحات تکمیلی" name="description" placeholder="توضیحات پرونده" defaultValue={initialCase?.description} wide textarea />
        <Field label="مبلغ دستمزد علی‌الحساب" name="advanceFee" placeholder="مثلاً ۵۰٬۰۰۰٬۰۰۰" defaultValue={formatAmount(initialCase?.advanceFee)} inputMode="numeric" amount />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={() => router.push(initialCase ? `/cases/${initialCase.id}` : "/cases")}>انصراف</button>
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? "در حال ذخیره..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({ label, name, placeholder, defaultValue, type = "text", required = false, wide = false, textarea = false, inputMode, maxLength, pattern, amount = false, numeric = false, time = false }: { label: string; name: string; placeholder?: string; defaultValue?: string; type?: string; required?: boolean; wide?: boolean; textarea?: boolean; inputMode?: "numeric" | "text" | "tel" | "email"; maxLength?: number; pattern?: string; amount?: boolean; numeric?: boolean; time?: boolean }) {
  return (
    <label className={wide ? "field field-wide" : "field"}>
      <span>{label}{required && <em> *</em>}</span>
      {textarea ? <textarea name={name} required={required} placeholder={placeholder} defaultValue={defaultValue} rows={name === "description" ? 4 : 3} /> : <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} inputMode={inputMode} maxLength={maxLength} pattern={pattern} onInput={amount ? (event) => { event.currentTarget.value = formatAmount(event.currentTarget.value); } : numeric ? (event) => { event.currentTarget.value = toPersianDigits(toLatinDigits(event.currentTarget.value).replace(/\D/g, "").slice(0, maxLength)); } : time ? (event) => { event.currentTarget.value = formatTimeInput(event.currentTarget.value); } : undefined} />}
    </label>
  );
}

function formatTimeInput(value: string | undefined) {
  const digits = toLatinDigits(value ?? "").replace(/\D/g, "").slice(0, 4);
  if (!digits) return "";
  const display = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  return toPersianDigits(display);
}

function normalizeMeetingTime(value: string) {
  const digits = toLatinDigits(value).replace(/\D/g, "");
  if (digits.length !== 4) return "";
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizePhone(value: string) {
  const normalized = toLatinDigits(value).replace(/[\s()-]/g, "");
  if (normalized.startsWith("+98") && normalized.length === 13) {
    return `0${normalized.slice(3)}`;
  }
  if (normalized.startsWith("98") && normalized.length === 12) {
    return `0${normalized.slice(2)}`;
  }
  return normalized;
}
