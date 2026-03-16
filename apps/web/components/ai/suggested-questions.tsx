"use client";

type Props = {
  onSelect: (query: string) => void;
  className?: string;
};

const SUGGESTED = [
  "What tokens are whales buying?",
  "What narratives are trending?",
  "What tokens have unusual volume?",
  "Best opportunities right now?",
  "SOL signals and radar",
];

export function SuggestedQuestions({ onSelect, className = "" }: Props) {
  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-medium text-[var(--b70-text-muted)]">
        Try asking
      </p>
      <ul className="flex flex-wrap gap-2">
        {SUGGESTED.map((q) => (
          <li key={q}>
            <button
              type="button"
              onClick={() => onSelect(q)}
              className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-left text-xs text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
