"use client";

import { useEffect, useRef, useState } from "react";
import {
  gregorianToJalali,
  jalaliMonthLength,
  jalaliToGregorianParts,
  toLatinDigits,
  toPersianDigits,
} from "../lib/cases";

const monthNames = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

type JalaliDatePickerProps = {
  label: string;
  name: string;
  required?: boolean;
  onChange?: (isoValue: string) => void;
  initialValue?: string;
};

export default function JalaliDatePicker({ label, name, required = false, onChange, initialValue = "" }: JalaliDatePickerProps) {
  const today = new Date();
  const todayJalali = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const initialJalali = getInitialJalali(initialValue, todayJalali);
  const [value, setValue] = useState(() => initialValue ? jalaliDisplay(initialJalali) : "");
  const [isoValue, setIsoValue] = useState(initialValue);
  const [viewYear, setViewYear] = useState(initialJalali[0]);
  const [viewMonth, setViewMonth] = useState(initialJalali[1]);
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const firstDayIso = jalaliToGregorianParts(viewYear, viewMonth, 1);
  const firstDay = new Date(`${firstDayIso[0]}-${String(firstDayIso[1]).padStart(2, "0")}-${String(firstDayIso[2]).padStart(2, "0")}T12:00:00`);
  const firstDayIndex = (firstDay.getDay() + 1) % 7;
  const days = Array.from({ length: firstDayIndex + jalaliMonthLength(viewYear, viewMonth) }, (_, index) => {
    const day = index - firstDayIndex + 1;
    return day > 0 ? day : null;
  });

  function setDate(day: number) {
    const selected = `${viewYear}/${String(viewMonth).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
    setValue(toPersianDigits(selected));
    const isoDate = toIsoDate(viewYear, viewMonth, day);
    setIsoValue(isoDate);
    onChange?.(isoDate);
    setOpen(false);
  }

  function moveMonth(offset: number) {
    const next = viewMonth + offset;
    if (next < 1) {
      setViewYear((year) => year - 1);
      setViewMonth(12);
    } else if (next > 12) {
      setViewYear((year) => year + 1);
      setViewMonth(1);
    } else {
      setViewMonth(next);
    }
  }

  function handleInputChange(nextValue: string) {
    const formatted = formatJalaliInput(nextValue);
    setValue(formatted);
    const digits = toLatinDigits(formatted).replace(/\D/g, "");
    if (digits.length === 8) {
      const parts = [
        Number(digits.slice(0, 4)),
        Number(digits.slice(4, 6)),
        Number(digits.slice(6, 8)),
      ];
      const isoDate = toIsoDate(parts[0], parts[1], parts[2]);
      setIsoValue(isoDate);
      onChange?.(isoDate);
      if (isoDate && parts[1] >= 1 && parts[1] <= 12) {
        setViewYear(parts[0]);
        setViewMonth(parts[1]);
      }
    } else {
      setIsoValue("");
      onChange?.("");
    }
  }

  function handleInputBlur() {
    const digits = toLatinDigits(value).replace(/\D/g, "");
    if (!value || (digits.length === 8 && isoValue)) return;
    setValue("");
    setIsoValue("");
    onChange?.("");
  }

  const isComplete = toLatinDigits(value).replace(/\D/g, "").length === 8;
  const isInvalid = isComplete && !isoValue;

  return (
    <div className="field date-picker-field" ref={pickerRef}>
      <span>{label}{required && <em> *</em>}</span>
      <div className="date-input-wrap">
        <input
          value={value}
          onChange={(event) => handleInputChange(event.target.value)}
          onBlur={handleInputBlur}
          onFocus={() => setOpen(true)}
          placeholder="۱۴۰۵/۰۵/۲۸"
          inputMode="numeric"
          maxLength={10}
          required={required}
          aria-invalid={isInvalid}
          aria-label={label}
          aria-haspopup="dialog"
        />
        <button type="button" className="calendar-trigger" onClick={() => setOpen((current) => !current)} aria-label={`باز کردن تقویم ${label}`} aria-expanded={open} aria-haspopup="dialog">
          <CalendarIcon />
        </button>
        <input type="hidden" name={name} value={isoValue} />
      </div>
      <small className={isInvalid ? "field-hint field-error-hint" : "field-hint"}>
        {isInvalid ? "تاریخ واردشده معتبر نیست." : "انتخاب از تقویم شمسی یا ورود به شکل ۱۴۰۵/۰۵/۲۸"}
      </small>
      {open && (
        <div className="jalali-calendar" role="dialog" aria-label={`تقویم ${label}`}>
          <div className="calendar-toolbar">
            <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">›</button>
            <strong>{monthNames[viewMonth - 1]} {toPersianDigits(viewYear)}</strong>
            <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">‹</button>
          </div>
          <div className="calendar-weekdays">{weekDays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-days">
            {days.map((day, index) => day === null ? <span className="calendar-day empty" key={`empty-${index}`} /> : <button type="button" key={day} className={isSelected(value, viewYear, viewMonth, day) ? "calendar-day selected" : "calendar-day"} onClick={() => setDate(day)}>{toPersianDigits(day)}</button>)}
          </div>
          <div className="calendar-footer">امروز: {toPersianDigits(todayJalali[0])}/{toPersianDigits(String(todayJalali[1]).padStart(2, "0"))}/{toPersianDigits(String(todayJalali[2]).padStart(2, "0"))}</div>
        </div>
      )}
    </div>
  );
}

function toIsoDate(year: number, month: number, day: number) {
  if (!year || month < 1 || month > 12 || day < 1 || day > jalaliMonthLength(year, month)) return "";
  const [gy, gm, gd] = jalaliToGregorianParts(year, month, day);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

function formatJalaliInput(value: string) {
  const digits = toLatinDigits(value).replace(/\D/g, "").slice(0, 8);
  const parts = [
    digits.slice(0, 4),
    digits.slice(4, 6),
    digits.slice(6, 8),
  ].filter(Boolean);
  return toPersianDigits(parts.join("/"));
}

function isSelected(value: string, year: number, month: number, day: number) {
  return toLatinDigits(value).replace(/-/g, "/") === `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function getInitialJalali(initialValue: string, fallback: readonly [number, number, number]) {
  if (!initialValue) return fallback;
  const [year, month, day] = initialValue.split("-").map(Number);
  if (!year || !month || !day) return fallback;
  return gregorianToJalali(year, month, day);
}

function jalaliDisplay([year, month, day]: readonly [number, number, number]) {
  return toPersianDigits(`${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`);
}

function CalendarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 9.5h17" /></svg>;
}
