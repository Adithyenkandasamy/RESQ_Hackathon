import React from "react";
import { cn } from "../../lib/cn";

export type ProvenanceType =
  | "reported-crew"
  | "extracted-image"
  | "ai-draft"
  | "clinician-confirmed"
  | "missing";

const PROVENANCE_CONFIG: Record<
  ProvenanceType,
  { label: string; className: string }
> = {
  "reported-crew": {
    label: "Reported by crew",
    className: "text-[#004b73] bg-[#E0F2FE] border-[#BAE6FD]",
  },
  "extracted-image": {
    label: "Extracted from image",
    className: "text-[#3f4850] bg-[#E8EDFF] border-[#bfc7d2]",
  },
  "ai-draft": {
    label: "AI-generated draft · requires clinical review",
    className: "text-[#D97706] bg-[#FEF3C7] border-[#FDE68A]",
  },
  "clinician-confirmed": {
    label: "Clinician-confirmed",
    className: "text-[#16A34A] bg-[#DCFCE7] border-[#86EFAC]",
  },
  missing: {
    label: "Missing / unverified",
    className: "text-[#ba1a1a] bg-[#FEE2E2] border-[#FCA5A5]",
  },
};

interface ProvenanceLabelProps {
  type: ProvenanceType;
  className?: string;
}

export function ProvenanceLabel({ type, className }: ProvenanceLabelProps) {
  const config = PROVENANCE_CONFIG[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        config.className,
        className
      )}
    >
      {type === "ai-draft" && (
        <span aria-hidden="true" className="text-[10px]">⚠</span>
      )}
      {config.label}
    </span>
  );
}
