import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";

const LINKS = [
  { href: "/", label: "Market" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/alpha", label: "Alpha" },
  { href: "/radar", label: "Radar" },
  { href: "/signals", label: "Signals" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/strategies", label: "Strategies" },
  { href: "/simulation", label: "Simulation" },
  { href: "/backtests", label: "Backtests" },
  { href: "/airdrops", label: "Airdrops" },
  { href: "/wallets", label: "Smart Wallets" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/alerts", label: "Alerts" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = typeof window !== "undefined" && !!getToken();

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <header className="mb-6 border-b border-slate-800 pb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Block70 Alpha Network
          </h1>
          <p className="text-xs text-slate-400">
            Crypto opportunity terminal for serious operators.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
          Alpha Network · MVP
        </span>
      </div>
      <nav className="mt-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex gap-2">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  active
                    ? "bg-emerald-500 text-slate-950 shadow shadow-emerald-500/30"
                    : "bg-slate-950 text-slate-300 hover:bg-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-900"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-900"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

