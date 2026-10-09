/**
 * Hospital Case Detail — /hospital/cases/:id
 *
 * Loads a single emergency by ID.
 * Also loads the hospital requests for that emergency to find the current
 * hospital's request (used for Accept/Decline actions).
 * Also loads destination info from GET /api/v1/emergencies/{id}/destination.
 *
 * Authorization: enforced server-side (_check_emergency_access).
 * Only shows admission actions for the request that belongs to the current
 * hospital — determined by matching request.hospital_id with user.hospital_id.
 */

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton } from "../../components/Skeleton";
import { ErrorState } from "../../components/ErrorState";
import { BackendEndpointRequired } from "../../components/ErrorState";
import { AdmissionRequestPanel } from "./AdmissionRequestPanel";
import { PatientInfoSection } from "./PatientInfoSection";
import { ActivityTimeline } from "./ActivityTimeline";
import { useAuth } from "../../auth/AuthContext";
import { getEmergency } from "../../api/emergencies";
import {
  getEmergencyRequests,
  getEmergencyDestination,
} from "../../api/hospitalRequests";
import { extractErrorMessage } from "../../api/client";
import type { EmergencyResponse } from "../../api/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-md border border-outline-variant bg-white p-4 " +
        (className ?? "")
      }
    >
      {children}
    </div>
  );
}

// ── Incident info section ─────────────────────────────────────────────────────

function IncidentSection({ emergency }: { emergency: EmergencyResponse }) {
  return (
    <section aria-labelledby="incident-info-heading">
      <h2
        id="incident-info-heading"
        className="text-[14px] font-semibold text-navy mb-3"
      >
        Incident Information
      </h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
            Case ID
          </dt>
          <dd
            className="text-[12px] font-mono text-navy mt-0.5"
            title={emergency.id}
          >
            {emergency.id}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
            Incident type
          </dt>
          <dd className="text-[13px] text-navy mt-0.5 font-medium">
            {emergency.incident_type}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
            Location (lat, lng)
          </dt>
          <dd className="text-[13px] text-navy mt-0.5 font-mono">
            {emergency.incident_latitude != null && emergency.incident_longitude != null
              ? `${emergency.incident_latitude.toFixed(6)}, ${emergency.incident_longitude.toFixed(6)}`
              : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
            Location captured at
          </dt>
          <dd className="text-[13px] text-navy mt-0.5">
            {formatDateTime(emergency.location_captured_at)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
            Reported at
          </dt>
          <dd className="text-[13px] text-navy mt-0.5">
            {formatDateTime(emergency.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
            Last updated
          </dt>
          <dd className="text-[13px] text-navy mt-0.5">
            {formatDateTime(emergency.updated_at)}
          </dd>
        </div>
        {emergency.incident_description && (
          <div className="col-span-full">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
              Description
            </dt>
            <dd className="text-[13px] text-navy mt-0.5 whitespace-pre-wrap">
              {emergency.incident_description}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

// ── Ambulance / Crew section ──────────────────────────────────────────────────

function AmbulanceSection({ emergency }: { emergency: EmergencyResponse }) {
  if (!emergency.assigned_ambulance_id) {
    return (
      <section aria-labelledby="ambulance-heading">
        <h2
          id="ambulance-heading"
          className="text-[14px] font-semibold text-navy mb-2"
        >
          Ambulance / Crew
        </h2>
        <p className="text-[13px] text-navy-secondary italic">
          No ambulance is currently assigned to this case.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="ambulance-heading">
      <h2
        id="ambulance-heading"
        className="text-[14px] font-semibold text-navy mb-3"
      >
        Ambulance / Crew
      </h2>
      <dl>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
            Ambulance ID
          </dt>
          <dd
            className="text-[12px] font-mono text-navy mt-0.5"
            title={emergency.assigned_ambulance_id}
          >
            {emergency.assigned_ambulance_id}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ── Destination section ───────────────────────────────────────────────────────

function DestinationSection({ emergencyId }: { emergencyId: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["emergencyDestination", emergencyId],
    queryFn: () => getEmergencyDestination(emergencyId),
  });

  return (
    <section aria-labelledby="destination-heading">
      <h2
        id="destination-heading"
        className="text-[14px] font-semibold text-navy mb-3"
      >
        Destination Assignment
      </h2>

      {isLoading && <Skeleton className="h-4 w-3/5" />}

      {isError && (
        <p className="text-[13px] text-navy-secondary italic">
          Destination information unavailable from the backend.
          {extractErrorMessage(error) && (
            <span className="block text-[12px] mt-0.5 text-outline">
              {extractErrorMessage(error)}
            </span>
          )}
        </p>
      )}

      {!isLoading && !isError && data && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
              Confirmed hospital
            </dt>
            <dd className="text-[13px] text-navy mt-0.5">
              {data.confirmed_hospital_name ??
                data.confirmed_hospital_id ??
                "No destination assigned"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
              Assignment status
            </dt>
            <dd className="mt-0.5">
              <StatusBadge type="emergency" status={data.status} />
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

// ── AI Handover section — backend does not yet expose this for hospital view ─

function AIHandoverSection() {
  return (
    <section aria-labelledby="ai-handover-heading">
      <div className="flex items-baseline gap-2 mb-2">
        <h2
          id="ai-handover-heading"
          className="text-[14px] font-semibold text-navy"
        >
          AI Handover Summary
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-wide text-navy bg-[#E0F2FE] border border-[#BAE6FD] rounded-full px-2 py-0.5">
          AI-generated draft &mdash; requires clinical review
        </span>
      </div>
      <BackendEndpointRequired feature="AI handover summary, transcription, and audio/image attachments" />
    </section>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CaseDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

// ── Back button ───────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      aria-label="Back to cases list"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to Cases
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HospitalCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const emergencyId = id ?? "";

  const {
    data: emergency,
    isLoading: emergencyLoading,
    isError: emergencyError,
    error: emergencyErr,
    refetch: refetchEmergency,
  } = useQuery({
    queryKey: ["emergency", emergencyId],
    queryFn: () => getEmergency(emergencyId),
    enabled: !!emergencyId,
  });

  // Load all requests for this emergency (hospital staff will see all, but backend
  // authorises via _check_emergency_access — only associated hospitals can access)
  const {
    data: requests,
    isLoading: requestsLoading,
  } = useQuery({
    queryKey: ["emergencyRequests", emergencyId],
    queryFn: () => getEmergencyRequests(emergencyId),
    enabled: !!emergencyId && !emergencyLoading && !emergencyError,
  });

  // Find the request belonging to the current hospital
  const myRequest =
    user?.hospital_id && requests
      ? requests.find((r) => r.hospital_id === user.hospital_id) ?? null
      : null;

  const httpStatus = (emergencyErr as { response?: { status?: number } })
    ?.response?.status;

  if (!emergencyId) {
    return (
      <AppShell>
        <ErrorState title="Invalid case" message="No case ID provided." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <BackButton onClick={() => navigate("/hospital/cases")} />

        {emergencyLoading && <CaseDetailSkeleton />}

        {emergencyError && (
          <>
            {httpStatus === 403 ? (
              <ErrorState
                title="Access denied"
                message="Your hospital is not associated with this emergency case."
              />
            ) : httpStatus === 404 ? (
              <ErrorState
                title="Case not found"
                message="This emergency case does not exist or has been removed."
              />
            ) : (
              <ErrorState
                title="Failed to load case"
                message={extractErrorMessage(emergencyErr)}
                onRetry={() => refetchEmergency()}
              />
            )}
          </>
        )}

        {!emergencyLoading && !emergencyError && emergency && (
          <>
            {/* Case header */}
            <PageHeader
              title={`Case: ${emergency.incident_type}`}
              subtitle={`ID: ${emergency.id}`}
              actions={<StatusBadge type="emergency" status={emergency.status} />}
            />

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left column — incident, patient, ambulance, destination, AI */}
              <div className="lg:col-span-2 space-y-4">
                <SectionCard>
                  <IncidentSection emergency={emergency} />
                </SectionCard>

                <SectionCard>
                  <PatientInfoSection patientInfo={emergency.patient_info} />
                </SectionCard>

                <SectionCard>
                  <AmbulanceSection emergency={emergency} />
                </SectionCard>

                <SectionCard>
                  <DestinationSection emergencyId={emergencyId} />
                </SectionCard>

                <SectionCard>
                  <AIHandoverSection />
                </SectionCard>
              </div>

              {/* Right column — admission request + timeline */}
              <div className="space-y-4">
                {/* Admission Request Panel */}
                {requestsLoading ? (
                  <SectionCard>
                    <Skeleton className="h-24 w-full" />
                  </SectionCard>
                ) : myRequest ? (
                  <AdmissionRequestPanel
                    request={myRequest}
                    emergencyId={emergencyId}
                  />
                ) : (
                  <SectionCard>
                    <h2 className="text-[14px] font-semibold text-navy mb-1">
                      Admission Request
                    </h2>
                    <p className="text-[13px] text-navy-secondary italic">
                      {emergency.confirmed_hospital_id === user?.hospital_id
                        ? "Your hospital is the confirmed destination for this case."
                        : "No admission request is on record for your hospital."}
                    </p>
                  </SectionCard>
                )}

                {/* Activity Timeline */}
                <SectionCard>
                  <ActivityTimeline emergencyId={emergencyId} />
                </SectionCard>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
