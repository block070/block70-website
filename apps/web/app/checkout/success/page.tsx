import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Welcome to Block70",
  description: "Your subscription checkout completed successfully.",
};

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const q = await searchParams;
  const hasSession = Boolean(q.session_id);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
        Block70
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
        You are in
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--b70-text-muted)]">
        Thanks for upgrading. Your plan should activate in a moment once Stripe confirms the subscription.
        {hasSession ? " You can manage billing anytime from your account." : null}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/opportunities">
          <Button className="w-full bg-[var(--b70-crypto-blue)] text-white hover:opacity-90 sm:w-auto">
            View opportunities
          </Button>
        </Link>
        <Link href="/usage">
          <Button variant="outline" className="w-full sm:w-auto">
            Usage & billing
          </Button>
        </Link>
      </div>
      <p className="mt-8 text-xs text-[var(--b70-text-muted)]">
        Not financial advice. Questions? Use the billing portal from Usage.
      </p>
    </div>
  );
}
