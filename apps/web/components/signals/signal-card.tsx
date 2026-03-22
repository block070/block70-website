import type { SignalDto } from "@/lib/types";
import Link from "next/link";
import { CoinSymbol } from "@/components/market/coin-symbol";

type SignalCardProps = {
  signal: SignalDto;
  href?: string;
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidenceColor(score: number): string {
  if (score >= 0.7) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 0.4) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  return "bg-slate-500/20 text-slate-400 border-slate-500/40";
}

function labelForType(signalType: string): string {
  return signalType.replace(/_/g, " ");
}

export function SignalCard({ signal, href }: SignalCardProps) {
  const token = signal.token_symbol || signal.token_address || "—";
  const title = signal.title || labelForType(signal.signal_type);
  const description = signal.description || null;
  const confidence = signal.confidence_score ?? 0;
  const confidencePct = `${(confidence * 100).toFixed(0)}%`;

  const content = (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs transition-colors hover:border-slate-700 hover:bg-slate-900/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CoinSymbol symbol={token} size="sm" />
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              {labelForType(signal.signal_type)}
            </span>
          </div>
          <p className="font-medium text-slate-200">{title}</p>
          {description ? (
            <p className="line-clamp-2 text-[11px] text-slate-400">{description}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${confidenceColor(confidence)}`}
            >
              Confidence {confidencePct}
            </span>
            <span className="text-[10px] text-slate-500">
              {formatTime(signal.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
