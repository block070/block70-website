type TokenChipProps = {
  symbol: string;
};

export function TokenChip({ symbol }: TokenChipProps) {
  return (
    <span className="inline-flex rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
      {symbol}
    </span>
  );
}

