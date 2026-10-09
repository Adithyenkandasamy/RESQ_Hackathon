import React from "react";
import { cn } from "../../lib/cn";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-outline-variant bg-white px-6 py-12 text-center",
        className
      )}
    >
      <svg
        className="mb-4 h-10 w-10 text-outline"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-3-3v6M3 12a9 9 0 1118 0A9 9 0 013 12z"
        />
      </svg>
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-navy-secondary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
