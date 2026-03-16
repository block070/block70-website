type Props = {
  websiteUrl?: string;
  docsUrl?: string;
  explorerUrl?: string;
  twitterHandle?: string;
  telegramUrl?: string;
};

export function CoinLinks({
  websiteUrl,
  docsUrl,
  explorerUrl,
  twitterHandle,
  telegramUrl,
}: Props) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Links
        </p>
        <ul className="space-y-1 text-slate-300">
          <li>
            <Label>Website</Label>
            <Value>
              {websiteUrl ? (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {websiteUrl}
                </a>
              ) : (
                "—"
              )}
            </Value>
          </li>
          <li>
            <Label>Docs</Label>
            <Value>
              {docsUrl ? (
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {docsUrl}
                </a>
              ) : (
                "—"
              )}
            </Value>
          </li>
          <li>
            <Label>Explorer</Label>
            <Value>
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {explorerUrl}
                </a>
              ) : (
                "—"
              )}
            </Value>
          </li>
        </ul>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Social & chain data
        </p>
        <ul className="space-y-1 text-slate-300">
          <li>
            <Label>Twitter</Label>
            <Value>
              {twitterHandle ? (
                <a
                  href={`https://twitter.com/${twitterHandle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  @{twitterHandle}
                </a>
              ) : (
                "—"
              )}
            </Value>
          </li>
          <li>
            <Label>Telegram</Label>
            <Value>
              {telegramUrl ? (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:text-emerald-200"
                >
                  {telegramUrl}
                </a>
              ) : (
                "—"
              )}
            </Value>
          </li>
          <li>
            <Label>On-chain view</Label>
            <Value className="text-slate-400">
              Placeholder for Block70&apos;s chain + wallet data panels. For
              now this is a static mock.
            </Value>
          </li>
        </ul>
      </div>
    </section>
  );
}

type TextProps = {
  children: React.ReactNode;
  className?: string;
};

function Label({ children }: TextProps) {
  return <span className="inline-block w-24 text-slate-400">{children}</span>;
}

function Value({ children, className }: TextProps) {
  return <span className={className}>{children}</span>;
}

