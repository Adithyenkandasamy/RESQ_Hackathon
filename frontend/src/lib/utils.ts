import type { EmergencyStatus, HospitalRequestStatus, AmbulanceStatus } from "../api/types";

// ── Date / time ────────────────────────────────────────────────────

/** ISO string → "Oct 10, 2026 01:43" */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** ISO string → "Oct 10, 2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Returns seconds remaining until a deadline, clamped to 0. */
export function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

/** Formats a seconds count as MM:SS */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Status labels ──────────────────────────────────────────────────

const EMERGENCY_STATUS_LABELS: Record<EmergencyStatus, string> = {
  CREATED: "Created",
  ASSESSMENT_IN_PROGRESS: "Assessment",
  SEARCHING_HOSPITAL: "Searching Hospital",
  ACCEPTANCE_PENDING: "Pending Acceptance",
  HOSPITAL_CONFIRMED: "Hospital Confirmed",
  TRANSPORTING: "Transporting",
  ARRIVED: "Arrived",
  HANDOVER_COMPLETED: "Handover Complete",
  CANCELLED: "Cancelled",
  ESCALATION_REQUIRED: "Escalation Required",
};

export function emergencyStatusLabel(s: EmergencyStatus): string {
  return EMERGENCY_STATUS_LABELS[s] ?? s;
}

const REQUEST_STATUS_LABELS: Record<HospitalRequestStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export function requestStatusLabel(s: HospitalRequestStatus): string {
  return REQUEST_STATUS_LABELS[s] ?? s;
}

const AMBULANCE_STATUS_LABELS: Record<AmbulanceStatus, string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  EN_ROUTE: "En Route",
  OUT_OF_SERVICE: "Out of Service",
};

export function ambulanceStatusLabel(s: AmbulanceStatus): string {
  return AMBULANCE_STATUS_LABELS[s] ?? s;
}

// ── Misc ───────────────────────────────────────────────────────────

/** Truncates text to a maximum character length. */
export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Safely renders unknown key/value pairs from patient_info as display entries. */
export function renderPatientInfoEntries(
  info: Record<string, unknown>
): [string, string][] {
  return Object.entries(info).map(([k, v]) => [
    // humanise the key
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    // never eval — just stringify
    typeof v === "object" ? JSON.stringify(v) : String(v ?? "—"),
  ]);
}
