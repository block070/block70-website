"use client";

import { useState, type ReactNode } from "react";

type TooltipProps = {
  children: ReactNode;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
};

export function Tooltip({ children, label, side = "top" }: TooltipProps) {
  const [show, setShow] = useState(false);

  const positionClass = {
    top: "bottom-full left-1/2 mb-1 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-1 -translate-x-1/2",
    left: "right-full top-1/2 mr-1 -translate-y-1/2",
    right: "left-full top-1/2 ml-1 -translate-y-1/2",
  };

  return (
    <span className="relative inline-flex">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="inline-flex cursor-default"
      >
        {children}
      </span>
      {show && (
        <span
          className={`
            absolute z-50 whitespace-nowrap rounded-b70-sm border border-[var(--b70-border)]
            bg-[var(--b70-card)] px-2 py-1 shadow-b70-card text-[var(--b70-text)]
            small
            ${positionClass[side]}
          `}
          role="tooltip"
        >
          {label}
        </span>
      )}
    </span>
  );
}
