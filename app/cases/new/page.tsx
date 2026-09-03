"use client";

import { useRouter } from "next/navigation";
import AuthGate from "../../components/AuthGate";
import CaseForm from "../../components/CaseForm";

export default function NewCasePage() {
  const router = useRouter();

  return (
    <AuthGate>
      <div className="page-shell narrow">
        <div className="page-header">
          <div>
            <p className="eyebrow">مدیریت پرونده‌ها</p>
            <h1>ثبت پرونده جدید</h1>
            <p className="muted">اطلاعات پرونده را با دقت وارد کنید.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={() => router.push("/cases")}>بازگشت</button>
        </div>
        <CaseForm submitLabel="ثبت پرونده" />
      </div>
    </AuthGate>
  );
}
