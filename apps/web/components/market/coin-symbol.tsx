type CoinSymbolProps = {
  symbol: string;
  logoUrl?: string | null;
  name?: string;
  size?: "sm" | "md";
  /** When true, only render the icon (no symbol text). Use when symbol/name appear separately. */
  iconOnly?: boolean;
};

const sizeClasses = {
  sm: "h-4 w-4 text-[9px]",
  md: "h-6 w-6 text-[10px]",
};

/** Renders a coin icon (or placeholder) plus optionally the symbol text. Use wherever a coin symbol appears. */
export function CoinSymbol({ symbol, logoUrl, name, size = "md", iconOnly = false }: CoinSymbolProps) {
  const sz = sizeClasses[size];
  const icon = (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 object-cover ${sz}`}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className={`rounded-full object-cover ${sz}`}
        />
      ) : (
        <span className="font-medium text-slate-400">
          {(symbol || name?.[0] || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
  if (iconOnly) return icon;
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      <span>{symbol}</span>
    </span>
  );
}
