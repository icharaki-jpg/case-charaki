"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthGate from "../../../components/AuthGate";
import CaseForm from "../../../components/CaseForm";
import { fetchCaseFromDatabase, toPersianDigits, type CaseRecord } from "../../../lib/cases";
import { getCurrentExpert } from "../../../lib/experts";

export default function EditCasePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<CaseRecord>();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCaseFromDatabase(id).then(setItem).catch(() => setItem(undefined));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!item) {
    return (
      <AuthGate>
        <div className="page-shell">
          <div className="content-card empty-state">
            <h2>پرونده پیدا نشد</h2>
            <button type="button" className="button button-secondary" onClick={() => router.push("/cases")}>بازگشت به پرونده‌ها</button>
          </div>
        </div>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <div className="page-shell narrow">
        <div className="page-header">
          <div>
            <p className="eyebrow">ویرایش پرونده</p>
            <h1>{toPersianDigits(item.caseNumber)}</h1>
            <p className="muted">اطلاعات پرونده را اصلاح و ذخیره کنید.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={() => router.push(`/cases/${item.id}`)}>انصراف</button>
        </div>
        <CaseForm key={item.id} initialCase={item} submitLabel="ذخیره تغییرات" />
      </div>
    </AuthGate>
  );
}
