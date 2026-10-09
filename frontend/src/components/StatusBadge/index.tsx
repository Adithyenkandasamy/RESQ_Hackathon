import React from "react";
import type { EmergencyStatus, HospitalRequestStatus, AmbulanceStatus } from "../../api/types";
import { cn } from "../../lib/cn";

type StatusVariant =
  | "critical"
  | "warning"
  | "success"
  | "info"
  | "neutral"
  | "muted";

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  critical:
    "bg-[#FEE2E2] text-[#ba1a1a] border border-[#FCA5A5]",
  warning:
    "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]",
  success:
    "bg-[#DCFCE7] text-[#16A34A] border border-[#86EFAC]",
  info:
    "bg-[#E0F2FE] text-[#006194] border border-[#BAE6FD]",
  neutral:
    "bg-[#F1F3FF] text-[#041b3c] border border-[#bfc7d2]",
  muted:
    "bg-[#E8EDFF] text-[#3f4850] border border-[#bfc7d2]",
};

const EMERGENCY_STATUS_VARIANT: Record<EmergencyStatus, StatusVariant> = {
  CREATED: "neutral",
  ASSESSMENT_IN_PROGRESS: "info",
  SEARCHING_HOSPITAL: "info",
  ACCEPTANCE_PENDING: "warning",
  HOSPITAL_CONFIRMED: "success",
  TRANSPORTING: "info",
  ARRIVED: "success",
  HANDOVER_COMPLETED: "muted",
  CANCELLED: "muted",
  ESCALATION_REQUIRED: "critical",
};

const REQUEST_STATUS_VARIANT: Record<HospitalRequestStatus, StatusVariant> = {
  PENDING: "warning",
  ACCEPTED: "success",
  DECLINED: "muted",
  EXPIRED: "critical",
  CANCELLED: "muted",
};

const AMBULANCE_STATUS_VARIANT: Record<AmbulanceStatus, StatusVariant> = {
  AVAILABLE: "success",
  BUSY: "warning",
  EN_ROUTE: "info",
  OUT_OF_SERVICE: "critical",
};

const EMERGENCY_STATUS_LABELS: Record<EmergencyStatus, string> = {
  CREATED: "Created",
  ASSESSMENT_IN_PROGRESS: "Assessment",
  SEARCHING_HOSPITAL: "Searching",
  ACCEPTANCE_PENDING: "Pending",
  HOSPITAL_CONFIRMED: "Confirmed",
  TRANSPORTING: "Transporting",
  ARRIVED: "Arrived",
  HANDOVER_COMPLETED: "Handover Done",
  CANCELLED: "Cancelled",
  ESCALATION_REQUIRED: "Escalation",
};

const REQUEST_STATUS_LABELS: Record<HospitalRequestStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const AMBULANCE_STATUS_LABELS: Record<AmbulanceStatus, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  EN_ROUTE: "En Route",
  OUT_OF_SERVICE: "Out of Service",
};

interface StatusBadgeProps {
  type: "emergency" | "request" | "ambulance" | "custom";
  status?: string;
  label?: string;
  variant?: StatusVariant;
  className?: string;
}

export function StatusBadge({
  type,
  status,
  label,
  variant,
  className,
}: StatusBadgeProps) {
  let resolvedVariant: StatusVariant = variant ?? "neutral";
  let resolvedLabel = label ?? status ?? "";

  if (type === "emergency" && status) {
    resolvedVariant = EMERGENCY_STATUS_VARIANT[status as EmergencyStatus] ?? "neutral";
    resolvedLabel = label ?? EMERGENCY_STATUS_LABELS[status as EmergencyStatus] ?? status;
  } else if (type === "request" && status) {
    resolvedVariant = REQUEST_STATUS_VARIANT[status as HospitalRequestStatus] ?? "neutral";
    resolvedLabel = label ?? REQUEST_STATUS_LABELS[status as HospitalRequestStatus] ?? status;
  } else if (type === "ambulance" && status) {
    resolvedVariant = AMBULANCE_STATUS_VARIANT[status as AmbulanceStatus] ?? "neutral";
    resolvedLabel = label ?? AMBULANCE_STATUS_LABELS[status as AmbulanceStatus] ?? status;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide leading-4 uppercase",
        VARIANT_CLASSES[resolvedVariant],
        className
      )}
    >
      {resolvedLabel}
    </span>
  );
}
