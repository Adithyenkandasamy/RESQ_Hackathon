/**
 * Admin Hospitals — /admin/hospitals
 *
 * Central directory + registration review.
 * - Tabs for Pending / Approved / Rejected registrations
 * - Approve or reject hospital applications (rejection records a reason)
 * - Uses the shared design system (AppShell, PageHeader, DataTable, StatusBadge)
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { Skeleton } from "../../components/Skeleton";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { useToast } from "../../components/Toast";
import { extractErrorMessage } from "../../api/client";
import {
  listHospitalRegistrations,
  approveHospitalRegistration,
  rejectHospitalRegistration,
} from "../../api/admin";
import type {
  HospitalRegistrationResponse,
  HospitalStatus,
} from "../../api/types";
import { cn } from "../../lib/cn";

type Tab = "PENDING" | "APPROVED" | "REJECTED";

const TABS: { key: Tab; label: string }[] = [
  { key: "PENDING", label: "Pending Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AdminHospitals() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("PENDING");

  const [approveTarget, setApproveTarget] =
    useState<HospitalRegistrationResponse | null>(null);
  const [rejectTarget, setRejectTarget] =
    useState<HospitalRegistrationResponse | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ── Query ──────────────────────────────────────────────────────────
  const {
    data: registrations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<HospitalRegistrationResponse[]>({
    queryKey: ["admin", "hospital-registrations", activeTab],
    queryFn: () => listHospitalRegistrations({ status: activeTab }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  // ── Approve ─────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (hospitalId: string) => approveHospitalRegistration(hospitalId),
    onSuccess: (res) => {
      invalidate();
      addToast(`${res.hospital.name} approved — staff can now sign in.`, "success");
      setApproveTarget(null);
    },
    onError: (err) => {
      addToast(`Approval failed: ${extractErrorMessage(err)}`, "error");
    },
  });

  // ── Reject ──────────────────────────────────────────────────────────
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectHospitalRegistration(id, { reason }),
    onSuccess: (res) => {
      invalidate();
      addToast(`${res.hospital.name} rejected.`, "success");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err) => {
      addToast(`Rejection failed: ${extractErrorMessage(err)}`, "error");
    },
  });

  const pendingCounts = registrations.filter(
    (r) => r.hospital.status === "PENDING"
  ).length;

  return (
    <AppShell pageTitle="Hospitals">
      <div className="space-y-6">
        <PageHeader
          title="Hospitals"
          subtitle="Review registration applications and manage the hospital network."
        />

        {/* Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-md border border-outline-variant p-0.5 bg-surface-container">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                  activeTab === tab.key
                    ? "bg-white text-navy shadow-sm"
                    : "text-navy-secondary hover:text-navy"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === "PENDING" && !isLoading && (
            <span className="text-xs font-medium text-navy-secondary">
              {pendingCounts} awaiting review
            </span>
          )}
        </div>

        {/* Table / States */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to load hospital registrations"
            message={extractErrorMessage(error)}
            onRetry={() => refetch()}
          />
        ) : registrations.length === 0 ? (
          <EmptyState
            title={
              activeTab === "PENDING"
                ? "No pending registrations"
                : activeTab === "APPROVED"
                ? "No approved hospitals"
                : "No rejected applications"
            }
            description={
              activeTab === "PENDING"
                ? "Applications submitted through the public registration form will appear here for review."
                : "Changes are reflected here after you approve or reject an application."
            }
          />
        ) : (
          <DataTable<HospitalRegistrationResponse>
            searchable
            searchPlaceholder="Search by hospital, ID, or applicant…"
            searchFilter={(row, q) =>
              [row.hospital.name, row.hospital.registration_identifier, row.applicant_email]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(q)
            }
            rows={registrations}
            getRowKey={(r) => r.hospital.id}
            columns={[
              {
                key: "name",
                header: "Hospital",
                render: (r) => (
                  <div className="flex flex-col">
                    <span className="font-medium text-navy">{r.hospital.name}</span>
                    <span className="text-xs text-navy-secondary">
                      {r.hospital.address}
                    </span>
                  </div>
                ),
              },
              {
                key: "regid",
                header: "Registration ID",
                render: (r) => (
                  <span className="font-mono text-xs text-navy-secondary">
                    {r.hospital.registration_identifier}
                  </span>
                ),
              },
              {
                key: "applicant",
                header: "Applicant",
                render: (r) => (
                  <span className="text-navy">{r.applicant_email ?? "—"}</span>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                render: (r) => (
                  <span className="text-navy-secondary">{r.hospital.contact_number}</span>
                ),
              },
              {
                key: "applied",
                header: "Applied",
                render: (r) => (
                  <span className="text-navy-secondary">
                    {formatDateTime(r.hospital.created_at)}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <div className="flex flex-col gap-1">
                    <StatusBadge
                      type="custom"
                      variant={
                        r.hospital.status === "APPROVED"
                          ? "success"
                          : r.hospital.status === "REJECTED"
                          ? "critical"
                          : "warning"
                      }
                      label={r.hospital.status}
                    />
                    {r.hospital.rejection_reason && (
                      <span className="text-[11px] text-navy-secondary max-w-[180px]">
                        {r.hospital.rejection_reason}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                className: "text-right",
                render: (r) => (
                  <div className="flex justify-end gap-2">
                    {r.hospital.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setApproveTarget(r)}
                          className="rounded border border-[#A7F3D0] px-2.5 py-1 text-xs font-medium text-[#065F46] hover:bg-[#ECFDF5] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectTarget(r)}
                          className="rounded border border-[#FCA5A5] px-2.5 py-1 text-xs font-medium text-[#ba1a1a] hover:bg-[#FFF5F5] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>

      {/* Approve confirmation */}
      <ConfirmDialog
        open={approveTarget !== null}
        title="Confirm approval"
        description={`Approve ${approveTarget?.hospital.name ?? "this hospital"}? Its staff account will be activated and able to sign in.`}
        confirmLabel="Approve"
        onConfirm={() => approveTarget && approveMutation.mutate(approveTarget.hospital.id)}
        onCancel={() => setApproveTarget(null)}
      />

      {/* Reject confirmation with reason */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm"
          onClick={() => setRejectTarget(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-title"
        >
          <div
            className="relative w-full max-w-md rounded-lg border border-outline-variant bg-white p-6 shadow-elevation-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reject-title" className="text-sm font-semibold text-navy mb-1">
              Reject application
            </h2>
            <p className="text-sm text-navy-secondary mb-4">
              Reject <span className="font-semibold text-navy">{rejectTarget.hospital.name}</span>
              ? The applicant will see the reason below if they sign in.
            </p>
            <label
              htmlFor="reject-reason"
              className="block text-[13px] font-medium text-navy mb-1.5"
            >
              Reason
            </label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Invalid registration identifier or unsupported facility type."
              className="w-full rounded-md border border-outline-variant px-3 py-2 text-[14px] text-navy placeholder:text-outline bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="rounded px-3 py-1.5 text-sm font-medium text-navy border border-outline-variant hover:bg-surface-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() =>
                  rejectMutation.mutate({
                    id: rejectTarget.hospital.id,
                    reason: rejectReason.trim() || "Application rejected.",
                  })
                }
                className="rounded px-3 py-1.5 text-sm font-medium text-white bg-[#ba1a1a] hover:bg-[#93000a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#ba1a1a] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {rejectMutation.isPending ? "Rejecting…" : "Reject application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}