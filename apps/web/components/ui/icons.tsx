"use client";

import {
  Activity,
  Wallet,
  Gift,
  Coins,
  MessageSquare,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

const iconSize = 20;

type IconProps = {
  className?: string;
  size?: number;
};

function createIcon(Icon: LucideIcon, defaultClassName?: string) {
  return function Block70Icon({
    className = "",
    size = iconSize,
  }: IconProps) {
    return (
      <Icon
        className={[defaultClassName, className].filter(Boolean).join(" ") || "text-[var(--b70-text-muted)]"}
        size={size}
        strokeWidth={2}
        aria-hidden
      />
    );
  };
}

export const SignalsIcon = createIcon(Activity, "text-crypto-blue");
export const WalletsIcon = createIcon(Wallet, "text-crypto-green");
export const AirdropsIcon = createIcon(Gift, "text-crypto-orange");
export const CoinsIcon = createIcon(Coins, "text-crypto-blue");
export const NarrativesIcon = createIcon(MessageSquare, "text-crypto-green");
export const NewsIcon = createIcon(Newspaper, "text-[var(--b70-text-muted)]");
