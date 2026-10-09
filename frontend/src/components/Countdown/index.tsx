import React, { useEffect, useState } from "react";
import { formatCountdown } from "../../lib/utils";
import { cn } from "../../lib/cn";

// ── Shared ticker singleton mechanism ─────────────────────────────────────────

type TickerListener = (now: number) => void;
const tickerListeners = new Set<TickerListener>();
let sharedIntervalId: ReturnType<typeof setInterval> | null = null;

function startSharedTicker() {
  if (sharedIntervalId === null && typeof window !== "undefined") {
    sharedIntervalId = setInterval(() => {
      const now = Date.now();
      tickerListeners.forEach((listener) => listener(now));
    }, 1000);
  }
}

function stopSharedTicker() {
  if (tickerListeners.size === 0 && sharedIntervalId !== null) {
    clearInterval(sharedIntervalId);
    sharedIntervalId = null;
  }
}

export function subscribeToSharedTicker(listener: TickerListener): () => void {
  tickerListeners.add(listener);
  startSharedTicker();
  return () => {
    tickerListeners.delete(listener);
    stopSharedTicker();
  };
}

// ── Countdown component ───────────────────────────────────────────────────────

export interface CountdownProps {
  deadline?: string | null; // ISO datetime string
  onExpire?: () => void;
  className?: string;
  showSuffix?: boolean; // default true -> " remaining"
}

export function Countdown({
  deadline,
  className,
  showSuffix = true,
}: CountdownProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  // Subscribe to the single shared ticker
  useEffect(() => {
    const unsubscribe = subscribeToSharedTicker((currentNow) => {
      setNow(currentNow);
    });
    return unsubscribe;
  }, []);

  // Recalculate immediately when the browser tab resumes visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Handle missing or null deadline
  if (!deadline) {
    return (
      <span className={cn("text-xs text-navy-secondary italic", className)}>
        —
      </span>
    );
  }

  const deadlineTime = new Date(deadline).getTime();
  // Handle invalid datetime
  if (Number.isNaN(deadlineTime)) {
    return (
      <span className={cn("text-xs text-navy-secondary italic", className)}>
        —
      </span>
    );
  }

  const secondsRemaining = Math.floor((deadlineTime - now) / 1000);
  const isExpired = secondsRemaining <= 0;
  const isUrgent = secondsRemaining > 0 && secondsRemaining <= 60;

  if (isExpired) {
    return (
      <span
        className={cn(
          "font-mono tabular-nums text-[11px] font-medium text-[#ba1a1a] bg-[#FFF5F5] px-2 py-0.5 rounded border border-[#FCA5A5]",
          className
        )}
        aria-live="polite"
        role="status"
      >
        Deadline passed — awaiting server status
      </span>
    );
  }

  const formatted = formatCountdown(secondsRemaining);
  const display = showSuffix ? `${formatted} remaining` : formatted;

  return (
    <span
      className={cn(
        "font-mono tabular-nums text-xs font-semibold px-2 py-0.5 rounded",
        isUrgent
          ? "text-[#D97706] bg-[#FEF3C7] border border-[#FCD34D]"
          : "text-navy bg-surface-container border border-outline-variant",
        className
      )}
      aria-live="polite"
      aria-label={`Response deadline in ${display}`}
      role="status"
    >
      {display}
    </span>
  );
}
