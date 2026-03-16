"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const INTERESTS = [
  { id: "arbitrage", label: "Arbitrage" },
  { id: "mining", label: "Liquidity mining" },
  { id: "wallets", label: "Smart wallets" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  function toggleInterest(id: string) {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function next() {
    setStep((s) => Math.min(4, s + 1));
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function finish() {
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl py-16">
      <p className="mb-4 text-xs uppercase tracking-wide text-emerald-300">
        Onboarding · Step {step} of 4
      </p>
      {step === 1 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to Block70
          </h1>
          <p className="text-sm text-slate-400">
            We&apos;ll calibrate the dashboard around how you hunt for alpha.
          </p>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose your interests
          </h1>
          <p className="text-sm text-slate-400">
            What types of plays are you most focused on right now?
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {INTERESTS.map((interest) => {
              const active = selectedInterests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-emerald-500 text-slate-950"
                      : "bg-slate-900 text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  {interest.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Suggested alerts
          </h1>
          <p className="text-sm text-slate-400">
            Based on your focus, we&apos;ll preconfigure a few alert templates
            you can customize later.
          </p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>• High-confidence arbitrage spreads above 5%</li>
            <li>• New TVL spikes on monitored pools</li>
            <li>• Smart wallet entries into your tracked tokens</li>
          </ul>
        </div>
      )}
      {step === 4 && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            First opportunity walkthrough
          </h1>
          <p className="text-sm text-slate-400">
            We&apos;ll take you through a live opportunity card and show how to
            interpret scores, liquidity, and execution steps.
          </p>
          <p className="text-xs text-slate-400">
            You can revisit this walkthrough any time from the dashboard.
          </p>
        </div>
      )}
      <div className="mt-10 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={back}
          disabled={step === 1}
          className="rounded-md border border-slate-800 px-3 py-1 text-slate-300 disabled:opacity-40"
        >
          Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-emerald-500 px-3 py-1 font-medium text-slate-950 hover:bg-emerald-400"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="rounded-md bg-emerald-500 px-3 py-1 font-medium text-slate-950 hover:bg-emerald-400"
          >
            Go to dashboard
          </button>
        )}
      </div>
    </div>
  );
}

