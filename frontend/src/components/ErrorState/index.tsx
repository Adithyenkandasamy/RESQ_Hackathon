import React from "react";
import { cn } from "../../lib/cn";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-[#FCA5A5] bg-[#FFF5F5] px-6 py-10 text-center",
        className
      )}
      role="alert"
    >
      <svg
        className="mb-3 h-8 w-8 text-[#ba1a1a]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
      <h3 className="text-sm font-semibold text-[#ba1a1a]">{title}</h3>
      <p className="mt-1 text-sm text-navy-secondary">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded px-3 py-1.5 text-sm font-medium text-primary border border-primary hover:bg-surface-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Shows when the backend is completely unreachable.
 */
export function BackendUnavailableState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      title="Backend unreachable"
      message="Cannot connect to the RESQ server. Check your network connection or try again."
      onRetry={onRetry}
    />
  );
}

/**
 * Shows for features whose backend endpoint doesn't exist yet.
 */
export function BackendEndpointRequired({ feature }: { feature: string }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-low p-4 text-sm text-navy-secondary">
      <span className="font-medium text-navy">Backend endpoint required</span>
      &nbsp;— {feature} is not available yet. See{" "}
      <code className="text-xs bg-surface-container px-1 py-0.5 rounded">
        BACKEND_REQUIREMENTS.md
      </code>{" "}
      for the required shape.
    </div>
  );
}
