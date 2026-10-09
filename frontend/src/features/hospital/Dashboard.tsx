/**
 * Hospital Dashboard — /hospital/dashboard
 *
 * Operational dashboard for hospital staff:
 * - Live emergency updates via Socket.IO with 15-second polling fallback
 * - Header with live connection status and last-updated timestamp
 * - Hospital profile and availability toggle (PATCH /api/v1/hospitals/me/availability)
 * - Authoritative summary metrics calculated from real API responses
 * - Incoming admission requests (Pending, Accepted, Expired tabs) with active Countdowns
 * - Recent emergency cases assigned to or associated with this hospital
 * - Deep-links to case details (/hospital/cases/:id)
 */

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { Countdown } from "../../components/Countdown";
import { useToast } from "../../components/Toast";
import { useAuth } from "../../auth/AuthContext";
import { listHospitalRequests } from "../../api/hospitalRequests";
import { listEmergencies } from "../../api/emergencies";
import { getMyHospital, updateHospitalAvailability } from "../../api/hospitals";
import { extractErrorMessage } from "../../api/client";
import {
  createHospitalSocket,
  type SocketConnectionState,
} from "../../lib/socket";
import type { HospitalRequestResponse, EmergencyResponse } from "../../api/types";
import { cn } from "../../lib/cn";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  try {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return date.toISOString();
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type TabType = "PENDING" | "ACCEPTED" | "EXPIRED";

export function HospitalDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const [socketStatus, setSocketStatus] =
    useState<SocketConnectionState>("connecting");
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [activeTab, setActiveTab] = useState<TabType>("PENDING");

  // ── Socket.IO Lifecycle ───────────────────────────────────────────────────

  useEffect(() => {
    if (!user || user.role !== "HOSPITAL_STAFF" || !user.hospital_id) {
      setSocketStatus("unavailable");
      return;
    }

    const socket = createHospitalSocket({
      user,
      queryClient,
      addToast,
      onStateChange: (state) => {
        setSocketStatus(state);
        if (state === "connected") {
          setLastUpdated(new Date());
        }
      },
    });

    return () => {
      socket?.disconnect();
    };
  }, [user, queryClient, addToast]);

  // 15-second fallback poll when socket is not connected
  const pollInterval = socketStatus === "connected" ? false : 15_000;

  // ── 1. Hospital Requests Query ────────────────────────────────────────────

  const {
    data: requests = [],
    isLoading: requestsLoading,
    isError: requestsError,
    error: requestsErr,
    refetch: refetchRequests,
  } = useQuery<HospitalRequestResponse[]>({
    queryKey: ["hospitalRequests"],
    queryFn: async () => {
      const res = await listHospitalRequests();
      setLastUpdated(new Date());
      return res;
    },
    refetchInterval: pollInterval,
  });

  // ── 2. Emergencies Query (Recent Cases) ───────────────────────────────────

  const {
    data: emergenciesData,
    isLoading: emergenciesLoading,
    isError: emergenciesError,
    error: emergenciesErr,
    refetch: refetchEmergencies,
  } = useQuery({
    queryKey: ["emergencies", "dashboard"],
    queryFn: async () => {
      const res = await listEmergencies({ page: 1, page_size: 5 });
      setLastUpdated(new Date());
      return res;
    },
    refetchInterval: pollInterval,
  });

  // ── 3. Hospital Profile & Availability Query ──────────────────────────────

  const {
    data: hospitalProfile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["myHospital"],
    queryFn: getMyHospital,
    enabled: Boolean(user?.hospital_id),
    refetchInterval: pollInterval,
  });

  // ── 4. Availability Mutation ──────────────────────────────────────────────

  const availabilityMutation = useMutation({
    mutationFn: async (accepting: boolean) => {
      const currentAvailability = hospitalProfile?.reported_availability ?? {};
      return updateHospitalAvailability({
        reported_availability: {
          ...currentAvailability,
          accepting_patients: accepting,
        },
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["myHospital"], updated);
      const isAccepting = updated.reported_availability?.accepting_patients === true;
      addToast(
        isAccepting
          ? "Hospital status updated to: Accepting emergency patients."
          : "Hospital status updated to: Diverting / Not accepting patients.",
        "success"
      );
    },
    onError: (err) => {
      addToast(
        `Failed to update availability: ${extractErrorMessage(err)}`,
        "error"
      );
    },
  });

  // ── Computed Summary Metrics ──────────────────────────────────────────────

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING"),
    [requests]
  );
  const acceptedRequests = useMemo(
    () => requests.filter((r) => r.status === "ACCEPTED"),
    [requests]
  );
  const expiredRequests = useMemo(
    () => requests.filter((r) => r.status === "EXPIRED"),
    [requests]
  );

  const activeCasesCount = useMemo(() => {
    if (!emergenciesData?.items) return 0;
    return emergenciesData.items.filter(
      (e: EmergencyResponse) => e.status !== "HANDOVER_COMPLETED" && e.status !== "CANCELLED"
    ).length;
  }, [emergenciesData]);

  const displayedRequests = useMemo(() => {
    if (activeTab === "PENDING") return pendingRequests;
    if (activeTab === "ACCEPTED") return acceptedRequests;
    return expiredRequests;
  }, [activeTab, pendingRequests, acceptedRequests, expiredRequests]);

  const isAcceptingPatients =
    hospitalProfile?.reported_availability?.accepting_patients !== false;

  return (
    <AppShell pageTitle="Hospital Dashboard">
      <div className="space-y-6">
        {/* ── Header: Title, Live Status Indicator, Last Updated ─────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Hospital Dashboard"
            subtitle="Monitor incoming emergency requests and hospital response activity."
          />

          <div className="flex items-center gap-3 shrink-0">
            {/* Live connection badge */}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                socketStatus === "connected"
                  ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                  : socketStatus === "reconnecting" || socketStatus === "connecting"
                  ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"
                  : "bg-surface-container text-navy-secondary border-outline-variant"
              )}
              title={
                socketStatus === "connected"
                  ? "Real-time updates active via WebSocket"
                  : socketStatus === "reconnecting"
                  ? "Reconnecting to live socket. Polling every 15s."
                  : "Live updates unavailable. Polling every 15s."
              }
              role="status"
              aria-live="polite"
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  socketStatus === "connected"
                    ? "bg-[#10B981] animate-pulse"
                    : socketStatus === "reconnecting"
                    ? "bg-[#F59E0B] animate-ping"
                    : socketStatus === "connecting"
                    ? "bg-[#F59E0B]"
                    : "bg-outline"
                )}
              />
              <span>
                {socketStatus === "connected"
                  ? "Live updates active"
                  : socketStatus === "reconnecting"
                  ? "Reconnecting…"
                  : socketStatus === "connecting"
                  ? "Connecting…"
                  : "Live updates offline"}
              </span>
            </div>

            {/* Last updated timestamp */}
            <span
              className="text-xs text-navy-secondary font-mono"
              title="Time of last REST/Socket data refresh"
            >
              Updated: {formatTime(lastUpdated)}
            </span>
          </div>
        </div>

        {/* ── Reconnecting Alert Banner ──────────────────────────────────── */}
        {(socketStatus === "reconnecting" || socketStatus === "disconnected") && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-md bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]"
            role="alert"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 shrink-0 text-[#D97706]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>
                <strong>Live updates lost. Reconnecting…</strong> Fallback polling
                is actively refreshing data every 15 seconds.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                refetchRequests();
                refetchEmergencies();
              }}
              className="underline font-semibold hover:text-[#78350F] focus-visible:outline-none"
            >
              Refresh now
            </button>
          </div>
        )}

        {/* ── Hospital Availability Card ─────────────────────────────────── */}
        <div className="rounded-md border border-outline-variant bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-navy">
                {profileLoading ? (
                  <Skeleton className="h-4 w-48 inline-block" />
                ) : (
                  hospitalProfile?.name ?? "Assigned Hospital"
                )}
              </h2>
              {hospitalProfile?.registration_identifier && (
                <span className="text-xs font-mono text-navy-secondary">
                  [{hospitalProfile.registration_identifier}]
                </span>
              )}
            </div>
            <p className="text-xs text-navy-secondary">
              Operational intake status reported to emergency dispatch service.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border",
                isAcceptingPatients
                  ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]"
                  : "bg-[#FFF5F5] text-[#ba1a1a] border-[#FCA5A5]"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isAcceptingPatients ? "bg-[#10B981]" : "bg-[#ba1a1a]"
                )}
              />
              {isAcceptingPatients
                ? "Accepting Patients"
                : "Diverting / Intake Paused"}
            </span>

            <button
              type="button"
              onClick={() => availabilityMutation.mutate(!isAcceptingPatients)}
              disabled={availabilityMutation.isPending || profileLoading}
              aria-busy={availabilityMutation.isPending}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isAcceptingPatients
                  ? "border-[#FCA5A5] text-[#ba1a1a] hover:bg-[#FFF5F5]"
                  : "border-[#A7F3D0] text-[#065F46] hover:bg-[#ECFDF5]"
              )}
            >
              {availabilityMutation.isPending
                ? "Updating…"
                : isAcceptingPatients
                ? "Pause Intake"
                : "Resume Intake"}
            </button>
          </div>
        </div>

        {/* ── Summary Metrics ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-md border border-outline-variant bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-secondary">
              Pending Requests
            </p>
            {requestsLoading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <p className="text-2xl font-bold text-navy mt-1">
                {pendingRequests.length}
              </p>
            )}
            <p className="text-[11px] text-navy-secondary mt-1">
              Awaiting hospital response
            </p>
          </div>

          <div className="rounded-md border border-outline-variant bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-secondary">
              Accepted Requests
            </p>
            {requestsLoading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <p className="text-2xl font-bold text-navy mt-1">
                {acceptedRequests.length}
              </p>
            )}
            <p className="text-[11px] text-navy-secondary mt-1">
              Confirmed for admission
            </p>
          </div>

          <div className="rounded-md border border-outline-variant bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-secondary">
              Expired Requests
            </p>
            {requestsLoading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <p className="text-2xl font-bold text-navy mt-1">
                {expiredRequests.length}
              </p>
            )}
            <p className="text-[11px] text-navy-secondary mt-1">
              Deadline passed without response
            </p>
          </div>

          <div className="rounded-md border border-outline-variant bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-navy-secondary">
              Active Assigned Cases
            </p>
            {emergenciesLoading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <p className="text-2xl font-bold text-navy mt-1">
                {activeCasesCount}
              </p>
            )}
            <p className="text-[11px] text-navy-secondary mt-1">
              In transit or active admission
            </p>
          </div>
        </div>

        {/* ── Admission Requests Section with Tabs ───────────────────────── */}
        <div className="rounded-md border border-outline-variant bg-white">
          <div className="p-4 border-b border-outline-variant flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-navy">
                Hospital Admission Requests
              </h2>
              <p className="text-xs text-navy-secondary">
                Review and monitor inbound admission requests sent to this hospital.
              </p>
            </div>

            {/* Status Tabs */}
            <div className="flex rounded-md border border-outline-variant p-0.5 bg-surface-container shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("PENDING")}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  activeTab === "PENDING"
                    ? "bg-white text-navy shadow-sm"
                    : "text-navy-secondary hover:text-navy"
                )}
              >
                Pending ({pendingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ACCEPTED")}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  activeTab === "ACCEPTED"
                    ? "bg-white text-navy shadow-sm"
                    : "text-navy-secondary hover:text-navy"
                )}
              >
                Accepted ({acceptedRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("EXPIRED")}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  activeTab === "EXPIRED"
                    ? "bg-white text-navy shadow-sm"
                    : "text-navy-secondary hover:text-navy"
                )}
              >
                Expired ({expiredRequests.length})
              </button>
            </div>
          </div>

          {/* Requests Content */}
          {requestsLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : requestsError ? (
            <div className="p-6">
              <ErrorState
                title="Failed to load admission requests"
                message={extractErrorMessage(requestsErr)}
                onRetry={() => refetchRequests()}
              />
            </div>
          ) : displayedRequests.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={
                  activeTab === "PENDING"
                    ? "No pending admission requests"
                    : activeTab === "ACCEPTED"
                    ? "No accepted requests"
                    : "No expired requests"
                }
                description={
                  activeTab === "PENDING"
                    ? "Inbound admission requests from dispatched ambulances will appear here in real time."
                    : activeTab === "ACCEPTED"
                    ? "Requests accepted by your hospital will appear here."
                    : "Admission requests that reached their response deadline without action."
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-low text-navy-secondary">
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Emergency ID
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Received At
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Status
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Response Deadline
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {displayedRequests.map((req) => (
                    <tr
                      key={req.id}
                      className="hover:bg-surface-low transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-navy">
                        <Link
                          to={`/hospital/cases/${req.emergency_id}`}
                          className="text-primary hover:underline"
                        >
                          {req.emergency_id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-navy-secondary">
                        {formatDateTime(req.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge type="request" status={req.status} />
                      </td>
                      <td className="py-3 px-4">
                        {req.status === "PENDING" ? (
                          <Countdown deadline={req.response_deadline} />
                        ) : (
                          <span className="text-navy-secondary">
                            {formatDateTime(req.response_deadline)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/hospital/cases/${req.emergency_id}`}
                          className="inline-flex items-center rounded border border-outline-variant px-2.5 py-1 text-xs font-medium text-primary hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          View Case
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Recent Emergency Activity Section ──────────────────────────── */}
        <div className="rounded-md border border-outline-variant bg-white">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-navy">
                Recent Emergency Cases
              </h2>
              <p className="text-xs text-navy-secondary">
                Active and recent emergency incidents assigned to or associated
                with this hospital.
              </p>
            </div>
            <Link
              to="/hospital/cases"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all cases &rarr;
            </Link>
          </div>

          {emergenciesLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : emergenciesError ? (
            <div className="p-6">
              <ErrorState
                title="Failed to load recent emergency cases"
                message={extractErrorMessage(emergenciesErr)}
                onRetry={() => refetchEmergencies()}
              />
            </div>
          ) : !emergenciesData?.items || emergenciesData.items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No recent emergency cases"
                description="Assigned cases will appear here as incidents are dispatched and confirmed."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-low text-navy-secondary">
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Case ID
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Incident Type
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Status
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Location
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Created
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {emergenciesData.items.slice(0, 5).map((caseItem: EmergencyResponse) => (
                    <tr
                      key={caseItem.id}
                      className="hover:bg-surface-low transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-navy">
                        <Link
                          to={`/hospital/cases/${caseItem.id}`}
                          className="text-primary hover:underline"
                        >
                          {caseItem.id.slice(0, 8).toUpperCase()}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-medium text-navy">
                        {caseItem.incident_type}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge type="emergency" status={caseItem.status} />
                      </td>
                      <td className="py-3 px-4 text-navy-secondary font-mono">
                        {caseItem.incident_latitude != null && caseItem.incident_longitude != null
                          ? `${caseItem.incident_latitude.toFixed(4)}, ${caseItem.incident_longitude.toFixed(4)}`
                          : "Unavailable"}
                      </td>
                      <td className="py-3 px-4 text-navy-secondary">
                        {formatDateTime(caseItem.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/hospital/cases/${caseItem.id}`}
                          className="inline-flex items-center rounded border border-outline-variant px-2.5 py-1 text-xs font-medium text-primary hover:bg-surface-container transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
