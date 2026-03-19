type LockOverlayProps = {
  message?: string;
};

export function LockOverlay({ message = "Unlock to view" }: LockOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/60 backdrop-blur-[2px]">
      <span className="rounded-full border border-slate-700 bg-slate-900/90 px-3 py-1 text-[11px] text-slate-200">
        {message}
      </span>
    </div>
  );
}

