import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonCard } from "../../components/Skeleton";
import { getEmergency, getEmergencyHistory } from "../../api/emergencies";

export function HospitalCaseDetail() {
  const { id } = useParams<{ id: string }>();

  const {
    data: emergency,
    isLoading: loadingEmergency,
    refetch: refetchEmergency,
  } = useQuery({
    queryKey: ["emergency-detail", id],
    queryFn: () => getEmergency(id!),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["emergency-history", id],
    queryFn: () => getEmergencyHistory(id!),
    enabled: Boolean(id),
  });

  if (loadingEmergency) {
    return (
      <AppShell pageTitle="Case Details">
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </AppShell>
    );
  }

  if (!emergency) {
    return (
      <AppShell pageTitle="Case Not Found">
        <div className="rounded-lg border border-outline-variant bg-white p-10 text-center">
          <h2 className="text-base font-bold text-navy">Emergency Case Not Found</h2>
          <p className="mt-1 text-xs text-navy-secondary">The requested emergency case record does not exist.</p>
          <Link to="/hospital/cases" className="mt-4 inline-block text-xs font-semibold text-primary underline">
            ← Return to Cases
          </Link>
        </div>
      </AppShell>
    );
  }

  const patientInfo = emergency.patient_info || {};
  const conditionNotes =
    (patientInfo as any)?.condition_description ||
    emergency.incident_description ||
    "No field condition notes provided.";
  const transcript = (emergency.transcription as any)?.transcript;
  const extractions = emergency.ai_extractions || [];
  const handoverSummary = emergency.handover_summary || (patientInfo as any)?.handover_summary;

  return (
    <AppShell pageTitle={`Case #${emergency.id.slice(0, 8)}`}>
      <div className="space-y-6">
        {/* Back Link & Header */}
        <div>
          <Link
            to="/hospital/cases"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mb-2"
          >
            ← Back to All Cases
          </Link>
          <PageHeader
            title={`Incident #${emergency.id.slice(0, 8)} • ${emergency.incident_type}`}
            subtitle={`Registered at ${new Date(emergency.created_at).toLocaleString()}`}
            actions={
              <div className="flex items-center gap-2">
                <StatusBadge type="emergency" status={emergency.status} />
                <button
                  type="button"
                  onClick={() => refetchEmergency()}
                  className="rounded border border-outline-variant bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:bg-surface-container"
                >
                  Refresh
                </button>
              </div>
            }
          />
        </div>

        {/* ── Core Clinical Section: Live Paramedic Patient Condition ── */}
        <div className="rounded-lg border-2 border-[#006194]/40 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-[#16A34A] animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#006194]">
                Paramedic Patient Condition & Field Assessment
              </h2>
            </div>
            <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#16A34A]">
              LIVE FIELD TELEMETRY
            </span>
          </div>

          {/* Description Text */}
          <div className="rounded-md bg-[#E0F2FE]/40 p-4 border border-[#006194]/20">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#006194] block mb-1">
              Field Clinical Narrative:
            </span>
            <p className="text-sm font-semibold text-navy leading-relaxed whitespace-pre-wrap">
              {conditionNotes}
            </p>
          </div>

          {/* Audio Transcript (ElevenLabs) */}
          {transcript && (
            <div className="rounded-md bg-surface p-3.5 border border-outline-variant">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-navy flex items-center gap-1.5">
                  <span>🎙️ Voice Audio Transcript</span>
                </span>
                <span className="text-[10px] text-navy-secondary font-medium">ElevenLabs Scribe AI</span>
              </div>
              <p className="text-xs italic text-navy/90 leading-relaxed">
                "{transcript}"
              </p>
            </div>
          )}

          {/* Structured Clinical Observations (Groq NLP) */}
          {extractions.length > 0 && (
            <div>
              <span className="text-xs font-bold text-navy block mb-2">
                Structured Clinical Entities Extracted by AI:
              </span>
              <div className="flex flex-wrap gap-2">
                {extractions.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-md border border-outline-variant bg-white px-3 py-1 text-xs shadow-2xs"
                  >
                    <span className="text-navy-secondary text-[11px] font-medium mr-1.5">
                      {item.entity_type || item.category || "Observation"}:
                    </span>
                    <strong className="text-navy">{item.extracted_value || item.value || item.name}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Handover Clinical Summary (SBAR) ── */}
        {handoverSummary && (
          <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
              Standardized Clinical Handover Summary (SBAR)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {typeof handoverSummary === "object" ? (
                Object.entries(handoverSummary).map(([key, val]) => (
                  <div key={key} className="rounded bg-surface p-3 border border-outline-variant">
                    <span className="font-bold text-primary uppercase block mb-1">{key}</span>
                    <p className="text-navy">{String(val)}</p>
                  </div>
                ))
              ) : (
                <p className="text-navy">{String(handoverSummary)}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Distinct Location Separation Card ── */}
        <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
            Emergency Dispatch Locations & Telemetry
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* 1. Incident Location */}
            <div className="rounded border border-outline-variant bg-surface p-3">
              <span className="font-semibold text-navy-secondary block mb-1">A. Incident Scene</span>
              <p className="font-medium text-navy">
                {emergency.incident_latitude && emergency.incident_longitude
                  ? `Lat: ${emergency.incident_latitude.toFixed(5)}, Lng: ${emergency.incident_longitude.toFixed(5)}`
                  : "Coordinates not recorded (text description used)"}
              </p>
              <span className="text-[10px] text-navy-secondary block mt-1">
                Source: Crew Scene Capture
              </span>
            </div>

            {/* 2. Ambulance Location */}
            <div className="rounded border border-outline-variant bg-surface p-3">
              <span className="font-semibold text-navy-secondary block mb-1">B. Ambulance Unit Telemetry</span>
              <p className="font-medium text-navy">
                {emergency.ambulance_latitude && emergency.ambulance_longitude
                  ? `Lat: ${emergency.ambulance_latitude.toFixed(5)}, Lng: ${emergency.ambulance_longitude.toFixed(5)}`
                  : "Unit streaming active"}
              </p>
              <span className="text-[10px] text-navy-secondary block mt-1">
                Last Telemetry: {emergency.ambulance_location_updated_at ? new Date(emergency.ambulance_location_updated_at).toLocaleTimeString() : "Live"}
              </span>
            </div>

            {/* 3. Hospital Destination */}
            <div className="rounded border border-outline-variant bg-surface p-3">
              <span className="font-semibold text-navy-secondary block mb-1">C. Confirmed Hospital Facility</span>
              <p className="font-medium text-navy">
                {emergency.hospital_name || "Your Hospital"}
              </p>
              <span className="text-[10px] text-[#16A34A] font-bold block mt-1">
                Destination Confirmed
              </span>
            </div>
          </div>
        </div>

        {/* ── Audit Trail & History Timeline ── */}
        <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-navy">
            Incident Event Log & Audit Trail ({history.length} events)
          </h3>
          {loadingHistory ? (
            <p className="text-xs text-navy-secondary">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-navy-secondary">No recorded history events.</p>
          ) : (
            <div className="space-y-2 border-l-2 border-primary/30 pl-4 text-xs">
              {history.map((ev: any) => (
                <div key={ev.id} className="relative py-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-navy">{ev.event_type}</span>
                    <span className="text-[11px] text-navy-secondary">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  {ev.new_status && (
                    <span className="text-navy-secondary block">
                      Transition: {ev.previous_status || "INITIAL"} → {ev.new_status}
                    </span>
                  )}
                  {ev.details && (
                    <p className="text-[11px] text-navy-secondary italic mt-0.5">
                      {JSON.stringify(ev.details)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
