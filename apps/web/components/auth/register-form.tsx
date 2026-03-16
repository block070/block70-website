"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { register } from "@/lib/auth";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") ?? undefined;
  const refSource = searchParams.get("source") ?? undefined;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptDisclaimer, setAcceptDisclaimer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!acceptTerms || !acceptPrivacy || !acceptDisclaimer) {
      setError("You must accept the Terms of Service, Privacy Policy, and Risk Disclaimer to register.");
      return;
    }
    setLoading(true);
    try {
      await register({
        email,
        password,
        name,
        ref_code: refCode,
        ref_source: refSource,
        accept_terms: acceptTerms,
        accept_privacy: acceptPrivacy,
        accept_disclaimer: acceptDisclaimer,
      });
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-300">
          Email
        </label>
        <input
          type="email"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-300">
          Name
        </label>
        <input
          type="text"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-300">
          Password
        </label>
        <input
          type="password"
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-3 rounded-md border border-slate-700 bg-slate-900/50 p-3">
        <p className="text-xs font-medium text-slate-300">You must agree to the following to register:</p>
        <label className="flex items-start gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 rounded border-slate-600"
          />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="text-emerald-400 hover:underline" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </Link>
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            className="mt-0.5 rounded border-slate-600"
          />
          <span>
            I agree to the{" "}
            <Link href="/legal/privacy" className="text-emerald-400 hover:underline" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={acceptDisclaimer}
            onChange={(e) => setAcceptDisclaimer(e.target.checked)}
            className="mt-0.5 rounded border-slate-600"
          />
          <span>
            I have read and accept the{" "}
            <Link href="/legal/disclaimer" className="text-emerald-400 hover:underline" target="_blank" rel="noopener noreferrer">
              Risk Disclaimer
            </Link>{" "}
            (Block70 is not financial advice)
          </span>
        </label>
      </div>
      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

