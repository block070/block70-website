import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md pt-20">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">
        Create your Block70 account
      </h1>
      <p className="mb-8 text-sm text-slate-400">
        Start with the Free plan and upgrade any time.
      </p>
      <Suspense fallback={<div className="text-slate-400">Loading…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}

