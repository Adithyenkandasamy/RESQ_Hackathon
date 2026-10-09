import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { Countdown } from "../../components/Countdown";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonCard } from "../../components/Skeleton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import {
  listHospitalRequests,
  acceptHospitalRequest,
  declineHospitalRequest,
} from "../../api/hospitalRequests";
import { getMyHospital } from "../../api/hospitals";
import { listEmergencies } from "../../api/emergencies";
import type { HospitalRequestResponse, EmergencyResponse } from "../../api/types";

export function HospitalDashboard() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [declineTarget, setDeclineTarget] = useState<HospitalRequestResponse | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // 1. Current Hospital Profile & Capacity
  const { data: hospital } = useQuery({
    queryKey: ["my-hospital"],
    queryFn: getMyHospital,
  });

  const availability = (hospital?.reported_availability || {}) as Record<string, any>;
  const icuAvailable = availability.icu_beds_available ?? 12;
  const icuTotal = availability.icu_beds_total ?? 15;
  const genAvailable = availability.general_beds_available ?? 40;
  const genTotal = availability.general_beds_total ?? 50;
  const opStatus = String(availability.operational_status || "OPEN");

  // 2. Incoming Admission Requests (Polled every 5 seconds for real-time responsiveness)
  const {
    data: requests = [],
    isLoading: loadingRequests,
    refetch: refetchRequests,
    isFetching: fetchingRequests,
  } = useQuery({
    queryKey: ["hospital-requests"],
    queryFn: () => listHospitalRequests(),
    refetchInterval: 5000,
  });

  // 3. Active Cases (Emergencies assigned to this hospital)
  const { data: emergenciesData, isLoading: loadingEmergencies } = useQuery({
    queryKey: ["hospital-active-emergencies"],
    queryFn: () => listEmergencies({ page_size: 50 }),
    refetchInterval: 8000,
  });

  // Filter pending requests for this hospital
  const pendingRequests = requests.filter((r) => r.status === "PENDING");

  // Filter emergencies that belong to this hospital and are active
  const activeCases = (emergenciesData?.items || []).filter(
    (e: EmergencyResponse) =>
      e.confirmed_hospital_id === hospital?.id &&
      ["HOSPITAL_CONFIRMED", "TRANSPORTING", "ARRIVED"].includes(e.status)
  );

  // Accept mutation
  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => acceptHospitalRequest(requestId),
    onSuccess: () => {
      addToast("Admission request accepted! Ambulance notified.", "success");
      queryClient.invalidateQueries({ queryKey: ["hospital-requests"] });
      queryClient.invalidateQueries({ queryKey: ["hospital-active-emergencies"] });
      queryClient.invalidateQueries({ queryKey: ["my-hospital"] });
    },
    onError: (err: any) => {
      addToast(err.message || "Failed to accept admission request.", "error");
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      declineHospitalRequest(requestId, { reason }),
    onSuccess: () => {
      addToast("Admission request declined.", "info");
      setDeclineTarget(null);
      setDeclineReason("");
      queryClient.invalidateQueries({ queryKey: ["hospital-requests"] });
    },
    onError: (err: any) => {
      addToast(err.message || "Failed to decline admission request.", "error");
    },
  });

  const handleConfirmDecline = () => {
    if (!declineTarget) return;
    declineMutation.mutate({
      requestId: declineTarget.id,
      reason: declineReason.trim() || undefined,
    });
  };

  return (
    <AppShell pageTitle="Hospital Dashboard">
      <div className="space-y-6">
        {/* Header with Hospital Info */}
        <PageHeader
          title={hospital?.name || "Hospital Emergency Command"}
          subtitle={`Trauma Facility • Operational Status: ${opStatus}`}
          actions={
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => refetchRequests()}
                className="flex items-center gap-2 rounded border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-surface-container transition-colors"
                title="Refresh Requests"
              >
                <svg
                  className={`h-3.5 w-3.5 text-primary ${fetchingRequests ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>Live Feed</span>
              </button>
            </div>
          }
        />

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-navy-secondary">Admission Requests</span>
              <span className={`flex h-2.5 w-2.5 rounded-full ${pendingRequests.length > 0 ? "bg-[#ba1a1a] animate-pulse" : "bg-outline-variant"}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-navy">{pendingRequests.length}</p>
            <p className="text-[11px] text-navy-secondary mt-1">Pending triage decision</p>
          </div>

          <div className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-navy-secondary">Inbound En Route</span>
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-navy">{activeCases.length}</p>
            <p className="text-[11px] text-navy-secondary mt-1">Transporting to hospital</p>
          </div>

          <div className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-navy-secondary">ICU Beds</span>
            <p className="mt-2 text-2xl font-bold text-navy">
              {`${icuAvailable} / ${icuTotal}`}
            </p>
            <p className="text-[11px] text-navy-secondary mt-1">Immediate intensive care</p>
          </div>

          <div className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-navy-secondary">General Beds</span>
            <p className="mt-2 text-2xl font-bold text-navy">
              {`${genAvailable} / ${genTotal}`}
            </p>
            <p className="text-[11px] text-navy-secondary mt-1">Capacity status: {opStatus}</p>
          </div>
        </div>

        {/* ── Section 1: Incoming Admission Requests (Pending Decision) ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-navy">Incoming Admission Requests</h2>
              {pendingRequests.length > 0 && (
                <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-xs font-bold text-[#ba1a1a]">
                  {pendingRequests.length} ACTION REQUIRED
                </span>
              )}
            </div>
          </div>

          {loadingRequests ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-navy">No Pending Admission Requests</h3>
              <p className="mt-1 text-xs text-navy-secondary">
                New dispatch requests from ambulances will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((req) => {
                const emergency = req.emergency;
                const patientInfo = emergency?.patient_info || {};
                const conditionDesc =
                  (patientInfo as any)?.condition_description ||
                  emergency?.incident_description ||
                  "No preliminary field note entered by crew.";
                const transcript = (emergency?.transcription as any)?.transcript;

                return (
                  <div
                    key={req.id}
                    className="overflow-hidden rounded-lg border-2 border-primary/40 bg-white shadow-md transition-all hover:shadow-lg"
                  >
                    {/* Top banner with Countdown */}
                    <div className="flex flex-wrap items-center justify-between border-b border-outline-variant bg-primary/5 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-[#ba1a1a] animate-ping" />
                        <span className="text-xs font-bold text-navy">
                          INCOMING EMERGENCY #{emergency?.id.slice(0, 8) || req.emergency_id.slice(0, 8)}
                        </span>
                        <StatusBadge
                          type="emergency"
                          status={emergency?.incident_type || "EMERGENCY"}
                          variant="critical"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-navy-secondary">Decision Window:</span>
                        <Countdown
                          deadline={req.response_deadline}
                          onExpire={() => refetchRequests()}
                          className="font-bold text-[#ba1a1a]"
                        />
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Paramedic Field Condition Note (Prominently Highlighted) */}
                      <div className="rounded-md border border-[#006194]/30 bg-[#E0F2FE]/40 p-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-[#006194]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#006194]">
                              Live Paramedic Field Assessment & Patient Condition
                            </h4>
                          </div>
                          <span className="inline-flex items-center rounded-full bg-[#16A34A]/10 px-2 py-0.5 text-[10px] font-bold text-[#16A34A]">
                            DIRECT FROM AMBULANCE
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-navy leading-relaxed">
                          {conditionDesc}
                        </p>

                        {/* Audio Dictation Transcription if available */}
                        {transcript && (
                          <div className="mt-2.5 rounded bg-white/70 p-2 text-xs text-navy border border-[#006194]/20">
                            <span className="font-bold text-[#006194]">🎙️ Audio Dictation: </span>
                            <span className="italic">"{transcript}"</span>
                          </div>
                        )}

                        {/* Extracted Vitals / Symptoms if available */}
                        {emergency?.ai_extractions && emergency.ai_extractions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {emergency.ai_extractions.map((item: any, idx: number) => (
                              <span
                                key={idx}
                                className="rounded bg-white px-2 py-0.5 text-[11px] font-medium text-navy border border-outline-variant"
                              >
                                {item.entity_type || "Observation"}: <strong>{item.extracted_value || item.name}</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Patient / Scene Photo if attached */}
                        {((patientInfo as any)?.image_url || ((patientInfo as any)?.images && (patientInfo as any).images[0])) && (
                          <div className="mt-3 flex items-center gap-3 rounded bg-white p-2.5 border border-[#006194]/20">
                            <img
                              src={(patientInfo as any)?.image_url || (patientInfo as any).images[0]}
                              alt="Trauma Scene"
                              className="h-16 w-16 rounded object-cover border border-outline-variant shadow-xs shrink-0"
                            />
                            <div>
                              <span className="text-xs font-bold text-navy block">📷 Patient / Trauma Photo Attached</span>
                              <span className="text-[11px] text-navy-secondary">Direct photographic capture transmitted by ambulance helper</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Scene & Transport details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-navy">
                        <div className="rounded border border-outline-variant bg-surface p-2.5">
                          <span className="font-semibold text-navy-secondary block mb-0.5">Incident Type / Triage</span>
                          <span className="font-medium">{emergency?.incident_type || "Critical Emergency"}</span>
                        </div>
                        <div className="rounded border border-outline-variant bg-surface p-2.5">
                          <span className="font-semibold text-navy-secondary block mb-0.5">Scene Location / Landmark</span>
                          <span className="font-medium">
                            {emergency?.incident_latitude && emergency?.incident_longitude
                              ? `GPS (${emergency.incident_latitude.toFixed(4)}, ${emergency.incident_longitude.toFixed(4)})`
                              : "Manual scene description provided"}
                          </span>
                        </div>
                      </div>

                      {/* Acceptance Action Buttons */}
                      <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-outline-variant">
                        <button
                          type="button"
                          onClick={() => {
                            setDeclineTarget(req);
                            setDeclineReason("");
                          }}
                          disabled={acceptMutation.isPending || declineMutation.isPending}
                          className="rounded-md border border-outline-variant px-4 py-2 text-xs font-semibold text-navy hover:bg-[#FEE2E2] hover:text-[#ba1a1a] transition-colors disabled:opacity-50"
                        >
                          Decline Request
                        </button>

                        <button
                          type="button"
                          onClick={() => acceptMutation.mutate(req.id)}
                          disabled={acceptMutation.isPending || declineMutation.isPending}
                          className="flex items-center gap-2 rounded-md bg-[#16A34A] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#15803D] transition-colors disabled:opacity-50"
                        >
                          {acceptMutation.isPending && (
                            <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          )}
                          <span>ACCEPT & PREPARE TRAUMA BAY</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section 2: Active Cases En Route to this Hospital ── */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-navy">Active Inbound Cases ({activeCases.length})</h2>
            <Link
              to="/hospital/cases"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View All Cases →
            </Link>
          </div>

          {loadingEmergencies ? (
            <SkeletonCard />
          ) : activeCases.length === 0 ? (
            <div className="rounded-lg border border-outline-variant bg-white p-6 text-center text-xs text-navy-secondary">
              No active inbound patients en route to your facility.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activeCases.map((ec: EmergencyResponse) => {
                const patientDesc =
                  (ec.patient_info as any)?.condition_description ||
                  ec.incident_description ||
                  "Patient en route";

                return (
                  <Link
                    key={ec.id}
                    to={`/hospital/cases/${ec.id}`}
                    className="block rounded-lg border border-outline-variant bg-white p-4 shadow-sm hover:border-primary transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-navy">
                        Case #{ec.id.slice(0, 8)} • {ec.incident_type}
                      </span>
                      <StatusBadge type="emergency" status={ec.status} />
                    </div>
                    <div className="mt-2.5 rounded bg-surface p-2 text-xs text-navy">
                      <span className="font-semibold text-navy-secondary block mb-0.5">Patient Condition:</span>
                      <p className="line-clamp-2">{patientDesc}</p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-navy-secondary">
                      <span>Status: {ec.status.replace(/_/g, " ")}</span>
                      <span className="font-semibold text-primary">Open Clinical Record →</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Decline Reason Dialog */}
      <ConfirmDialog
        open={Boolean(declineTarget)}
        title="Decline Hospital Admission"
        description="Please provide an operational or clinical reason for declining admission so dispatch can route to the next qualified facility."
        confirmLabel="Decline Request"
        cancelLabel="Keep Request"
        destructive
        onConfirm={handleConfirmDecline}
        onCancel={() => {
          setDeclineTarget(null);
          setDeclineReason("");
        }}
      />
    </AppShell>
  );
}
