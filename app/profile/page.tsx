"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import AuthGate from "../components/AuthGate";
import { formatDate, toLatinDigits, toPersianDigits } from "../lib/cases";
import {
  changeExpertPassword,
  getCurrentExpert,
  normalizeMeetingReminderDays,
  type ExpertProfileUpdate,
  type ExpertRecord,
  updateExpertProfile,
} from "../lib/experts";

const emptyProfile: ExpertProfileUpdate = {
  fullName: "",
  phone: "",
  expertise: "",
  licenseNumber: "",
  address: "",
  notes: "",
  meetingReminderEnabled: true,
  meetingReminderDays: 2,
};

export default function ProfilePage() {
  const [expert, setExpert] = useState<ExpertRecord>();
  const [profile, setProfile] = useState<ExpertProfileUpdate>(emptyProfile);
  const [profileError, setProfileError] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentExpert = getCurrentExpert();
      setExpert(currentExpert);
      if (currentExpert) {
        setProfile({
          fullName: currentExpert.fullName,
          phone: currentExpert.phone,
          expertise: currentExpert.expertise,
          licenseNumber: currentExpert.licenseNumber,
          address: currentExpert.address,
          notes: currentExpert.notes,
          meetingReminderEnabled: currentExpert.meetingReminderEnabled ?? true,
          meetingReminderDays: normalizeMeetingReminderDays(currentExpert.meetingReminderDays),
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateProfileField<K extends keyof ExpertProfileUpdate>(
    field: K,
    value: ExpertProfileUpdate[K],
  ) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");

    if (!expert) {
      setProfileError("حساب کارشناس پیدا نشد؛ لطفاً دوباره وارد شوید.");
      return;
    }
    if (!profile.fullName.trim() || !profile.expertise.trim()) {
      setProfileError("نام و رشته کارشناسی را وارد کنید.");
      return;
    }

    const phone = toLatinDigits(profile.phone).replace(/\D/g, "");
    if (phone && !/^09\d{9}$/.test(phone)) {
      setProfileError("شماره تلفن باید ۱۱ رقم و با ۰۹ شروع شود؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.");
      return;
    }

    if (
      typeof profile.meetingReminderDays !== "number" ||
      profile.meetingReminderDays < 1 ||
      profile.meetingReminderDays > 30
    ) {
      setProfileError("تعداد روز یادآوری باید بین ۱ تا ۳۰ روز باشد.");
      return;
    }

    try {
      const updatedExpert = updateExpertProfile(expert.id, {
        ...profile,
        fullName: profile.fullName.trim(),
        phone,
        expertise: profile.expertise.trim(),
        licenseNumber: profile.licenseNumber.trim(),
        address: profile.address.trim(),
        notes: profile.notes.trim(),
        meetingReminderEnabled: profile.meetingReminderEnabled ?? true,
        meetingReminderDays: normalizeMeetingReminderDays(profile.meetingReminderDays),
      });
      setExpert(updatedExpert);
      setProfile({
        fullName: updatedExpert.fullName,
        phone: updatedExpert.phone,
        expertise: updatedExpert.expertise,
        licenseNumber: updatedExpert.licenseNumber,
        address: updatedExpert.address,
        notes: updatedExpert.notes,
        meetingReminderEnabled: updatedExpert.meetingReminderEnabled ?? true,
        meetingReminderDays: normalizeMeetingReminderDays(updatedExpert.meetingReminderDays),
      });
      setProfileMessage("اطلاعات پروفایل با موفقیت ذخیره شد.");
    } catch (profileUpdateError) {
      setProfileError(
        profileUpdateError instanceof Error
          ? profileUpdateError.message
          : "ذخیره اطلاعات پروفایل انجام نشد.",
      );
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword.length < 8) {
      setPasswordError("رمز جدید باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setPasswordError("رمز جدید و تکرار آن یکسان نیست.");
      return;
    }

    try {
      await changeExpertPassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordConfirmation("");
      setPasswordMessage("رمز عبور با موفقیت تغییر کرد.");
    } catch (passwordChangeError) {
      setPasswordError(
        passwordChangeError instanceof Error
          ? passwordChangeError.message
          : "تغییر رمز عبور انجام نشد.",
      );
    }
  }

  return (
    <AuthGate>
      {!expert ? (
        <div className="page-shell">
          <div className="content-card loading-state">در حال بارگذاری پروفایل...</div>
        </div>
      ) : (
        <div className="page-shell narrow">
          <div className="page-header">
            <div>
              <p className="eyebrow">حساب کاربری</p>
              <h1>پروفایل من</h1>
              <p className="muted">اطلاعات کارشناس و رمز عبور خود را مدیریت کنید.</p>
            </div>
            <Link href="/" className="button button-secondary">بازگشت به داشبورد</Link>
          </div>

          <form onSubmit={handleProfileSubmit} className="content-card form-card">
            <div className="form-section-title">
              <h2>اطلاعات پروفایل</h2>
              <p className="muted">کد ملی و ایمیل ثبت‌شده قابل ویرایش نیستند.</p>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>نام و نام خانوادگی <em>*</em></span>
                <input
                  value={profile.fullName}
                  onChange={(event) => updateProfileField("fullName", event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>کد ملی</span>
                <input value={toPersianDigits(expert.nationalId)} readOnly />
              </label>
              <label className="field">
                <span>شماره تلفن</span>
                <input
                  value={toPersianDigits(profile.phone)}
                  onChange={(event) => updateProfileField("phone", toLatinDigits(event.target.value).replace(/\D/g, "").slice(0, 11))}
                  type="tel"
                  inputMode="tel"
                  maxLength={11}
                  placeholder="اختیاری؛ مانند ۰۹۱۲۱۲۳۴۵۶۷"
                />
              </label>
              <label className="field">
                <span>ایمیل</span>
                <input value={expert.email} readOnly type="email" />
              </label>
              <label className="field">
                <span>رشته و صلاحیت کارشناسی <em>*</em></span>
                <input
                  value={profile.expertise}
                  onChange={(event) => updateProfileField("expertise", event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>شماره پروانه کارشناسی</span>
                <input
                  value={toPersianDigits(profile.licenseNumber)}
                  onChange={(event) => updateProfileField("licenseNumber", toLatinDigits(event.target.value))}
                />
              </label>
              <label className="field">
                <span>تاریخ عضویت</span>
                <input value={formatDate(expert.membershipDate)} readOnly />
              </label>
              <div className="field field-wide profile-reminder-settings">
                <span>یادآوری جلسه کارشناسی</span>
                <div className="reminder-settings-row">
                  <label className="reminder-toggle">
                    <input
                      type="checkbox"
                      checked={profile.meetingReminderEnabled ?? true}
                      onChange={(event) =>
                        updateProfileField("meetingReminderEnabled", event.target.checked)
                      }
                    />
                    <span>نمایش جلسه‌های نزدیک در داشبورد فعال باشد</span>
                  </label>
                  <label className="reminder-days-field">
                    <span>چند روز قبل</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={toPersianDigits(String(profile.meetingReminderDays ?? 2))}
                      onChange={(event) => {
                        const digits = toLatinDigits(event.target.value)
                          .replace(/\D/g, "")
                          .slice(0, 2);
                        updateProfileField(
                          "meetingReminderDays",
                          digits ? Number(digits) : undefined,
                        );
                      }}
                    />
                    <small>از ۱ تا ۳۰ روز</small>
                  </label>
                </div>
                <small className="field-hint">
                  فقط جلسه‌هایی که در این بازه قرار دارند در داشبورد نمایش داده می‌شوند.
                </small>
              </div>
              <label className="field field-wide">
                <span>نشانی</span>
                <input
                  value={profile.address}
                  onChange={(event) => updateProfileField("address", event.target.value)}
                />
              </label>
              <label className="field field-wide">
                <span>توضیحات</span>
                <textarea
                  value={profile.notes}
                  onChange={(event) => updateProfileField("notes", event.target.value)}
                  rows={4}
                />
              </label>
            </div>
            {profileError && <p className="form-error">{profileError}</p>}
            {profileMessage && <p className="form-success">{profileMessage}</p>}
            <div className="form-actions">
              <button type="submit" className="button button-primary">ذخیره اطلاعات پروفایل</button>
            </div>
          </form>

          <form onSubmit={handlePasswordSubmit} className="content-card form-card">
            <div className="form-section-title">
              <h2>تغییر رمز عبور</h2>
              <p className="muted">برای امنیت حساب، رمز فعلی را نیز وارد کنید.</p>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>رمز عبور فعلی <em>*</em></span>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className="field">
                <span>رمز عبور جدید <em>*</em></span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <label className="field">
                <span>تکرار رمز عبور جدید <em>*</em></span>
                <input
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </div>
            {passwordError && <p className="form-error">{passwordError}</p>}
            {passwordMessage && <p className="form-success">{passwordMessage}</p>}
            <div className="form-actions">
              <button type="submit" className="button button-primary">تغییر رمز عبور</button>
            </div>
          </form>
        </div>
      )}
    </AuthGate>
  );
}
