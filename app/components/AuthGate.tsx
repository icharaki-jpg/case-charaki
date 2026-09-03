"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getCurrentExpert, hasServerSession } from "../lib/experts";

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const expert = getCurrentExpert();
      if (!expert) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        if (!cancelled) setChecking(false);
        return;
      }

      const sessionIsValid = await hasServerSession(expert.email);
      if (cancelled) return;
      if (sessionIsValid) {
        setAuthorized(true);
      } else {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
      setChecking(false);
    }

    const timer = window.setTimeout(() => {
      void checkAccess();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname, router]);

  if (checking || !authorized) {
    return <div className="page-shell"><div className="content-card loading-state">در حال بررسی دسترسی...</div></div>;
  }

  return children;
}
