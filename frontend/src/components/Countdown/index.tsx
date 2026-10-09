import React, { useEffect, useRef, useState } from "react";
import { secondsUntil, formatCountdown } from "../../lib/utils";
import { cn } from "../../lib/cn";

interface CountdownProps {
  deadline: string; // ISO datetime string
  onExpire?: () => void;
  className?: string;
}

export function Countdown({ deadline, onExpire, className }: CountdownProps) {
  const [seconds, setSeconds] = useState(() => secondsUntil(deadline));
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const tick = () => {
      const s = secondsUntil(deadline);
      setSeconds(s);
      if (s === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);

  const isExpired = seconds === 0;
  const isUrgent = seconds > 0 && seconds <= 60;

  return (
    <span
      className={cn(
        "font-mono tabular-nums text-sm font-medium",
        isExpired
          ? "text-[#ba1a1a]"
          : isUrgent
          ? "text-[#D97706]"
          : "text-navy",
        className
      )}
      aria-live="polite"
      aria-label={
        isExpired
          ? "Response deadline expired"
          : `Response deadline in ${formatCountdown(seconds)}`
      }
    >
      {isExpired ? "Expired" : formatCountdown(seconds)}
    </span>
  );
}
