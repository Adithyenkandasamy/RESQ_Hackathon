/**
 * Admin Dashboard — /admin/dashboard
 *
 * Operational overview for administrators, backed by GET /api/v1/admin/dashboard.
 * Uses the shared design system (AppShell, PageHeader, Skeleton, EmptyState, ErrorState).
 */

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton } from "../../components/Skeleton";
import { ErrorState } from "../../components/ErrorState";
import { getAdminDashboard } from "../../api/admin";
import { extractErrorMessage } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/Toast";
import {
  createHospitalSocket,
  type SocketConnectionState,
} from "../../lib/socket";
import type { AdminDashboardResponse, EmergencyStatus } from "../../api/types";

const STATUS_ORDER: EmergencyStatus[] = [
  "CREATED",
  "ASSESSMENT_IN_PROGRESS",
  "SEARCHING_HOSPITAL",
  "ACCEPTANCE_PENDING",
  "HOSPITAL_CONFIRMED",
  "TRANSPORTING",
  "ARRIVED",
  "HANDOVER_COMPLETED",
  "CANCELLED",
  "ESCALATION_REQUIRED",
];

export function AdminDashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [socketState, setSocketState] = useState<SocketConnectionState>("connecting");

  // Real-time Socket.IO connection for admin room
  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;
    const socket = createHospitalSocket({
      user,
      queryClient,
      addToast,
      onStateChange: setSocketState,
    });
    return () => {
      socket?.disconnect();
    };
  }, [user, queryClient, addToast]);

  const pollInterval = socketState === "connected" ? false : 15_000;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AdminDashboardResponse>({
    queryKey: ["admin", "dashboard"],
    queryFn: getAdminDashboard,
    refetchInterval: pollInterval,
  });

  return (
    <AppShell pageTitle="Admin Dashboard">
      <div className="space-y-6">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Operational overview of hospitals, ambulances, and active emergencies."
          actions={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full border border-outline-variant bg-white px-2.5 py-1 text-xs font-medium shadow-2xs">
                <span className={`h-2 w-2 rounded-full ${socketState === "connected" ? "bg-[#16A34A] animate-pulse" : "bg-[#16A34A]"}`} />
                <span className="text-navy text-[11px] font-semibold">
                  {socketState === "connected" ? "Real-time Live" : "Live Active"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded border border-outline-variant bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-surface-container transition-colors shadow-2xs"
                title="Refresh Metrics"
              >
                Refresh
              </button>
            </div>
          }
        />

        {/* Summary metrics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            {
              label: "Total Hospitals",
              hint: "Registered in the network",
              value: data?.total_hospitals,
            },
            {
              label: "Total Ambulances",
              hint: "Fleet inventory",
              value: data?.total_ambulances,
            },
            {
              label: "Available Ambulances",
              hint: "Ready for dispatch",
              value: data?.available_ambulances,
            },
            {
              label: "Active Emergencies",
              hint: "Non-terminal incidents",
              value: data?.active_emergencies,
            },
            {
              label: "Active Users",
              hint: "Staff with sign-in access",
              value: data?.total_users,
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="rounded-md border border-outline-variant bg-white p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-navy-secondary">
                {metric.label}
              </p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-2" />
              ) : (
                <p className="text-2xl font-bold text-navy mt-1">{metric.value ?? "—"}</p>
              )}
              <p className="text-[11px] text-navy-secondary mt-1">{metric.hint}</p>
            </div>
          ))}
        </div>

        {/* Emergencies by status */}
        <div className="rounded-md border border-outline-variant bg-white">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-navy">Emergencies by Status</h2>
              <p className="text-xs text-navy-secondary">
                Current distribution of all incidents in the system.
              </p>
            </div>
            <Link
              to="/admin/emergencies"
              className="text-xs font-medium text-primary hover:underline"
            >
              View emergencies &rarr;
            </Link>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : isError ? (
            <div className="p-6">
              <ErrorState
                title="Failed to load dashboard metrics"
                message={extractErrorMessage(error)}
                onRetry={() => refetch()}
              />
            </div>
          ) : !data || Object.values(data.emergencies_by_status).every((n) => n === 0) ? (
            <div className="p-8 text-center">
              <p className="text-sm text-navy-secondary">
                No emergencies recorded yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-low text-navy-secondary">
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide">
                      Status
                    </th>
                    <th className="py-2.5 px-4 font-medium uppercase tracking-wide text-right">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {STATUS_ORDER.filter(
                    (s) => data.emergencies_by_status[s] && data.emergencies_by_status[s] > 0
                  ).map((s) => (
                    <tr key={s} className="hover:bg-surface-low transition-colors">
                      <td className="py-3 px-4">
                        <StatusBadge type="emergency" status={s} />
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-navy">
                        {data.emergencies_by_status[s]}
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