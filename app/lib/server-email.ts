import "server-only";

import { Resend } from "resend";

export async function sendVerificationEmail(input: {
  email: string;
  code: string;
  purpose: "register" | "resetPassword";
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== "production") return { ok: true as const, skipped: true as const };
    return { ok: false as const, reason: "notConfigured" as const };
  }

  const resend = new Resend(apiKey);
  const title = input.purpose === "register" ? "تأیید ثبت‌نام کارشناس" : "بازیابی رمز عبور";
  const result = await resend.emails.send({
    from,
    to: [input.email],
    subject: `سامانه کارشناسی - ${title}`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8">
        <h2>${title}</h2>
        <p>کد تأیید شما:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${input.code}</p>
        <p>این کد تا ۱۰ دقیقه معتبر است. اگر این درخواست از طرف شما نبوده، این پیام را نادیده بگیرید.</p>
      </div>
    `,
  });
  if (result.error) {
    console.error("Verification email failed:", result.error);
    return { ok: false as const, reason: "sendFailed" as const };
  }
  return { ok: true as const, skipped: false as const };
}
