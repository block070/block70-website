"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        await getCurrentUser();
        if (!active) return;
        setChecking(false);
      } catch {
        if (!active) return;
        router.replace("/login");
      }
    }
    check();
    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-400">
        Checking authentication…
      </div>
    );
  }

  return <>{children}</>;
}

