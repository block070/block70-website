"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Market",
    items: [
      { href: "/market", label: "Macro" },
      { href: "/coins", label: "Coins" },
      { href: "/trending", label: "Trending" },
      { href: "/categories", label: "Categories" },
      { href: "/chains", label: "Chains" },
      { href: "/exchanges", label: "Exchanges" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/signals", label: "Signals" },
      { href: "/radar", label: "Radar" },
      { href: "/opportunities", label: "Opportunities" },
      { href: "/alpha", label: "Alpha" },
      { href: "/insights", label: "AI Insights" },
    ],
  },
  {
    title: "Discovery",
    items: [
      { href: "/airdrops", label: "Airdrops" },
      { href: "/narratives", label: "Narratives" },
      { href: "/news", label: "News" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: "/wallets", label: "Wallets" },
      { href: "/wallets/smart", label: "Smart wallets" },
      { href: "/flows", label: "Capital flow" },
      { href: "/simulation", label: "Simulations" },
    ],
  },
  {
    title: "Developer",
    items: [
      { href: "/developers", label: "API & keys" },
      { href: "/developers/docs", label: "API docs" },
      { href: "/developers/analytics", label: "Usage" },
      { href: "/status", label: "Service status" },
    ],
  },
  {
    title: "Bots",
    items: [
      { href: "/bots", label: "Signal bots" },
    ],
  },
  {
    title: "Rewards",
    items: [
      { href: "/rewards/store", label: "Store" },
      { href: "/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    title: "Legal",
    items: [
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-hidden
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-[var(--b70-border)] bg-[var(--b70-card)] transition-transform duration-200 ease-out md:relative md:top-0 md:h-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <nav className="flex h-full flex-col gap-6 overflow-y-auto p-3">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    item.href !== "/"
                      ? pathname.startsWith(item.href)
                      : pathname === "/";
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => onClose()}
                        className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-blue-500/20 text-blue-600 dark:text-blue-300"
                            : "text-[var(--b70-text-muted)] hover:bg-[var(--b70-border)] hover:text-[var(--b70-text)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
