"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const LINKS = [
  { href: "/smartwallets", label: "Directory", exact: true },
  { href: "/smartwallets/watchlist", label: "Watchlist", exact: false },
  { href: "/smartwallets/alerts", label: "Alerts", exact: false },
] as const;

export function SmartwalletsSubnav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-[var(--b70-border)] pb-3">
      {LINKS.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-[var(--b70-crypto-blue)] text-white"
                : "text-[var(--b70-text-muted)] hover:bg-[var(--b70-card)] hover:text-[var(--b70-text)]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
