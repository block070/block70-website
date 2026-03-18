"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";

const TWITTER_URL = "https://twitter.com/intent/tweet";
const TELEGRAM_URL = "https://t.me/share/url";

export type ShareButtonsProps = {
  /** Page or content URL to share */
  url: string;
  /** Prefilled tweet/telegram text */
  title?: string;
  /** Optional: signal ID for recording share (requires auth) */
  signalId?: number;
  /** Optional: strategy ID for strategy pages */
  strategyId?: number;
  /** Compact (icons only) or default (with labels) */
  variant?: "default" | "compact";
  className?: string;
};

function buildTwitterHref(url: string, title?: string): string {
  const params = new URLSearchParams();
  params.set("url", url);
  if (title) params.set("text", title);
  return `${TWITTER_URL}?${params.toString()}`;
}

function buildTelegramHref(url: string, title?: string): string {
  const params = new URLSearchParams();
  params.set("url", url);
  if (title) params.set("text", title);
  return `${TELEGRAM_URL}?${params.toString()}`;
}

function buildDiscordShareUrl(url: string, title?: string): string {
  const text = title ? `${title} ${url}` : url;
  return `https://discord.com/channels/@me?text=${encodeURIComponent(text)}`;
}

export function ShareButtons({
  url,
  title,
  signalId,
  variant = "default",
  className = "",
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShare = async (platform: string) => {
    if (signalId && typeof window !== "undefined") {
      const token = window.localStorage.getItem("block70_access_token");
      if (token) {
        try {
          await fetch(
            `${API_BASE_URL}/api/v1/signals/share/${signalId}?platform=${encodeURIComponent(platform)}`,
            { method: "POST", headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          // best-effort record
        }
      }
    }
  };

  const openTwitter = () => {
    handleShare("twitter");
    window.open(buildTwitterHref(url, title), "_blank", "noopener,noreferrer");
  };

  const openTelegram = () => {
    handleShare("telegram");
    window.open(buildTelegramHref(url, title), "_blank", "noopener,noreferrer");
  };

  const openDiscord = () => {
    handleShare("discord");
    window.open(buildDiscordShareUrl(url, title), "_blank", "noopener,noreferrer");
  };

  const onCopy = () => {
    handleShare("copy");
    handleCopy();
  };

  const btnClass = variant === "compact" ? "h-8 w-8 p-0" : "";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        className={btnClass}
        onClick={openTwitter}
        aria-label="Share on X (Twitter)"
      >
        <XIcon className="h-4 w-4" />
        {variant === "default" && <span className="ml-1.5">X</span>}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={btnClass}
        onClick={openTelegram}
        aria-label="Share on Telegram"
      >
        <TelegramIcon className="h-4 w-4" />
        {variant === "default" && <span className="ml-1.5">Telegram</span>}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={btnClass}
        onClick={openDiscord}
        aria-label="Share on Discord"
      >
        <DiscordIcon className="h-4 w-4" />
        {variant === "default" && <span className="ml-1.5">Discord</span>}
      </Button>
      <Button
        type="button"
        variant="outline"
        className={btnClass}
        onClick={onCopy}
        aria-label="Copy link"
      >
        {copied ? (
          <CheckIcon className="h-4 w-4 text-emerald-400" />
        ) : (
          <CopyIcon className="h-4 w-4" />
        )}
        {variant === "default" && (
          <span className="ml-1.5">{copied ? "Copied" : "Copy link"}</span>
        )}
      </Button>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
