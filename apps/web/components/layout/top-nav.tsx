"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { GlobalSearch } from "@/components/search/global-search";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BlockBalance } from "@/components/rewards/block-balance";

const TOP_LINKS = [
  { href: "/", label: "Market" },
  { href: "/ai-search", label: "AI Search" },
  { href: "/copilot", label: "Copilot" },
  { href: "/signals", label: "Signals" },
  { href: "/airdrops", label: "Airdrops" },
  { href: "/wallets", label: "Wallets" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/news", label: "News" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = typeof window !== "undefined" && !!getToken();

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-4 border-b border-[var(--b70-border)] bg-[var(--b70-card)] px-4 shadow-b70-card">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 font-semibold text-[var(--b70-text)]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-crypto-blue text-sm font-bold text-white">
          B70
        </span>
        <span className="hidden text-sm sm:inline">Block70</span>
      </Link>

      <div className="hidden flex-1 justify-center md:flex">
        <div className="w-full max-w-sm">
          <GlobalSearch />
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto text-xs scrollbar-hide">
        {TOP_LINKS.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
            className={`shrink-0 rounded-lg px-3 py-2 font-medium transition-colors ${
              active
                  ? "bg-crypto-blue/20 text-crypto-blue"
                  : "text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] hover:text-[var(--b70-text)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        {isAuthenticated ? (
          <>
            <BlockBalance />
            <Link
              href="/account"
              className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] hover:text-[var(--b70-text)]"
            >
              Account
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] hover:text-[var(--b70-text)]"
            >
              Log out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:opacity-90"
          >
            Log in
          </Link>
        )}
      </div>
    </header>
  );
}
