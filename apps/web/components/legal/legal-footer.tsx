import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--b70-border)] bg-[var(--b70-card)] px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-xs text-[var(--b70-text-muted)]">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/legal/terms" className="hover:text-[var(--b70-text)]">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-[var(--b70-text)]">
            Privacy
          </Link>
          <Link href="/legal/disclaimer" className="hover:text-[var(--b70-text)]">
            Disclaimer
          </Link>
          <Link href="/legal/community-guidelines" className="hover:text-[var(--b70-text)]">
            Community Guidelines
          </Link>
          <Link href="/legal/api-terms" className="hover:text-[var(--b70-text)]">
            API Terms
          </Link>
          <Link href="/legal/cookie-policy" className="hover:text-[var(--b70-text)]">
            Cookies
          </Link>
          <Link href="/legal/affiliate-disclosure" className="hover:text-[var(--b70-text)]">
            Affiliate
          </Link>
          <Link href="/contact" className="hover:text-[var(--b70-text)]">
            Contact
          </Link>
        </div>
        <p className="text-[var(--b70-text-muted)]">
          © {new Date().getFullYear()} Block70. Not financial advice.
        </p>
      </div>
    </footer>
  );
}
