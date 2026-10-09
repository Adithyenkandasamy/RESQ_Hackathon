/**
 * Emergency Activity Timeline
 *
 * Displays audit history from GET /api/v1/emergencies/{id}/history
 * Returns EmergencyHistoryResponse[] sorted ascending by created_at.
 *
 * Does NOT invent timeline events.
 * Shows a graceful empty / error state.
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../../components/Skeleton";
import { ErrorState } from "../../components/ErrorState";
import { getEmergencyHistory } from "../../api/emergencies";
import { extractErrorMessage } from "../../api/client";
import type { EmergencyHistoryResponse } from "../../api/types";

// ── Event type labels ────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Case created",
  STATUS_CHANGE: "Status changed",
  PATIENT_UPDATE: "Patient information updated",
  LOCATION_UPDATE: "Location updated",
  HOSPITAL_ASSIGNMENT: "Hospital confirmed",
  DISPATCH_REQUESTS_SENT: "Hospital dispatch requests sent",
  MATCHING_FAILED: "No hospitals found — escalation required",
  TRANSCRIPTION: "Audio transcription completed",
  OBSERVATION_EXTRACTION: "Clinical observations extracted",
  HANDOVER_GENERATED: "AI handover summary generated",
  HANDOVER_CONFIRMED: "Handover summary confirmed",
};

function labelForEvent(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, " ");
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Status transition label ──────────────────────────────────────────────────

function StatusTransition({
  previous,
  next,
}: {
  previous: string | null;
  next: string | null;
}) {
  if (!previous && !next) return null;
  const fmt = (s: string | null) =>
    s ? s.replace(/_/g, " ") : "—";

  return (
    <span className="text-[12px] text-navy-secondary">
      {fmt(previous)} &rarr; {fmt(next)}
    </span>
  );
}

// ── Single timeline entry ────────────────────────────────────────────────────

function TimelineEntry({ entry }: { entry: EmergencyHistoryResponse }) {
  return (
    <li className="relative pl-6 pb-5 last:pb-0">
      {/* Connector line */}
      <span
        className="absolute left-[7px] top-4 bottom-0 w-px bg-outline-variant last:hidden"
        aria-hidden="true"
      />
      {/* Dot */}
      <span
        className="absolute left-0 top-[6px] flex h-[15px] w-[15px] items-center justify-center rounded-full border-2 border-primary bg-white"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-navy">
          {labelForEvent(entry.event_type)}
        </span>

        {(entry.previous_status || entry.new_status) && (
          <StatusTransition
            previous={entry.previous_status}
            next={entry.new_status}
          />
        )}

        <span className="text-[12px] text-navy-secondary">
          {formatDateTime(entry.created_at)}
        </span>

        {entry.actor_user_id && (
          <span className="text-[11px] text-outline font-mono">
            Actor: {entry.actor_user_id.slice(0, 8)}
          </span>
        )}
      </div>
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ActivityTimelineProps {
  emergencyId: string;
}

export function ActivityTimeline({ emergencyId }: ActivityTimelineProps) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["emergencyHistory", emergencyId],
    queryFn: () => getEmergencyHistory(emergencyId),
  });

  return (
    <section aria-labelledby="timeline-heading">
      <h2
        id="timeline-heading"
        className="text-[14px] font-semibold text-navy mb-4"
      >
        Activity Timeline
      </h2>

      {isLoading && (
        <div className="space-y-3" aria-label="Loading timeline">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}

      {isError && (
        <ErrorState
          title="Could not load activity timeline"
          message={extractErrorMessage(error)}
          onRetry={() => refetch()}
          className="py-6"
        />
      )}

      {!isLoading && !isError && (!data || data.length === 0) && (
        <p className="text-[13px] text-navy-secondary italic">
          No activity history available for this case.
        </p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <ol aria-label="Case activity timeline" className="list-none">
          {data.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}
    </section>
  );
}
