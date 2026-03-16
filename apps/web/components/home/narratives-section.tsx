import Link from "next/link";

const NARRATIVES = [
  { id: "ai", name: "AI", tokens: ["FET", "RENDER", "TAO", "AKT"], href: "/narratives" },
  { id: "depin", name: "DePIN", tokens: ["HNT", "FIL", "AR", "IOT"], href: "/narratives" },
  { id: "gaming", name: "Gaming", tokens: ["IMX", "GALA", "AXS", "SAND"], href: "/narratives" },
  { id: "layer2", name: "Layer 2", tokens: ["ARB", "OP", "STRK", "MATIC"], href: "/narratives" },
  { id: "rwa", name: "Real World Assets", tokens: ["ONDO", "MKR", "GFI"], href: "/narratives" },
];

export function NarrativesSection() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-50">
            Trending narratives
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-400">
            AI, DePIN, Gaming, L2, RWA
          </p>
        </div>
        <Link
          href="/narratives"
          className="text-xs font-medium text-blue-400 hover:text-blue-300"
        >
          Explore
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {NARRATIVES.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm transition-colors hover:border-slate-700"
          >
            <span className="font-medium text-slate-100">{n.name}</span>
            <span className="ml-2 text-[11px] text-slate-400">
              {n.tokens.slice(0, 3).join(", ")}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
