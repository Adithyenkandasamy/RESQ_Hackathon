/**
 * Hospital Cases List — /hospital/cases
 *
 * Loads emergencies accessible to the authenticated hospital staff user.
 * Uses GET /api/v1/emergencies (paginated, status-filtered).
 * Hospital staff can only see cases their hospital has been dispatched for
 * or is the confirmed destination — enforced server-side.
 */

import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { ErrorState } from "../../components/ErrorState";
import { listEmergencies } from "../../api/emergencies";
import { extractErrorMessage } from "../../api/client";
import type { EmergencyResponse, EmergencyStatus } from "../../api/types";

// ── Status filter options (all backend-supported EmergencyStatus values) ────

const ALL_STATUSES: { value: EmergencyStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "CREATED", label: "Created" },
  { value: "ASSESSMENT_IN_PROGRESS", label: "Assessment in progress" },
  { value: "SEARCHING_HOSPITAL", label: "Searching hospital" },
  { value: "ACCEPTANCE_PENDING", label: "Acceptance pending" },
  { value: "HOSPITAL_CONFIRMED", label: "Hospital confirmed" },
  { value: "TRANSPORTING", label: "Transporting" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "HANDOVER_COMPLETED", label: "Handover completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ESCALATION_REQUIRED", label: "Escalation required" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

// ── Pagination controls ───────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, onPrev, onNext }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-[13px] text-navy-secondary">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded px-3 py-1.5 text-sm font-medium border border-outline-variant text-navy-secondary hover:bg-surface-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Previous page"
        >
          &larr; Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded px-3 py-1.5 text-sm font-medium border border-outline-variant text-navy-secondary hover:bg-surface-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Next page"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HospitalCaseList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<EmergencyStatus | "">("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  const queryParams = {
    page,
    page_size: PAGE_SIZE,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["emergencies", "hospital", statusFilter, page],
    queryFn: () => listEmergencies(queryParams),
  });

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatusFilter(e.target.value as EmergencyStatus | "");
      setPage(1); // reset pagination on filter change
    },
    []
  );

  const columns = [
    {
      key: "id",
      header: "Case ID",
      render: (row: EmergencyResponse) => (
        <span
          className="font-mono text-[12px] text-navy-secondary"
          title={row.id}
        >
          {shortId(row.id)}
        </span>
      ),
      className: "w-[90px]",
    },
    {
      key: "incident_type",
      header: "Incident type",
      render: (row: EmergencyResponse) => (
        <span className="font-medium text-navy">{row.incident_type}</span>
      ),
    },
    {
      key: "location",
      header: "Location (lat, lng)",
      render: (row: EmergencyResponse) => (
        <span className="text-navy-secondary text-[13px]">
          {row.incident_latitude != null && row.incident_longitude != null
            ? `${row.incident_latitude.toFixed(4)}, ${row.incident_longitude.toFixed(4)}`
            : "Unavailable"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Emergency status",
      render: (row: EmergencyResponse) => (
        <StatusBadge type="emergency" status={row.status} />
      ),
    },
    {
      key: "created_at",
      header: "Reported",
      render: (row: EmergencyResponse) => (
        <span className="text-[13px] text-navy-secondary whitespace-nowrap">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "updated_at",
      header: "Last updated",
      render: (row: EmergencyResponse) => (
        <span className="text-[13px] text-navy-secondary whitespace-nowrap">
          {formatDateTime(row.updated_at)}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      render: (row: EmergencyResponse) => (
        <button
          type="button"
          className="text-primary text-[13px] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/hospital/cases/${row.id}`);
          }}
          aria-label={`View case ${shortId(row.id)}`}
        >
          View
        </button>
      ),
      className: "w-[72px] text-right",
    },
  ];

  const httpStatus = (error as { response?: { status?: number } })?.response
    ?.status;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Emergency Cases"
          subtitle="Emergency cases dispatched to or confirmed for your hospital."
        />

        {/* Filters row */}
        <div className="flex items-center gap-3 flex-wrap">
          <label
            htmlFor="status-filter"
            className="text-[13px] font-medium text-navy-secondary"
          >
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusChange}
            aria-label="Filter by emergency status"
            className="h-[36px] rounded-md border border-outline-variant bg-white px-2 text-[13px] text-navy focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {isFetching && !isLoading && (
            <span className="text-[12px] text-navy-secondary animate-pulse">
              Refreshing&hellip;
            </span>
          )}
        </div>

        {/* Content */}
        {isError ? (
          httpStatus === 403 ? (
            <ErrorState
              title="Access denied"
              message="Your account is not associated with a hospital, or you do not have permission to view emergency cases."
            />
          ) : (
            <ErrorState
              title="Failed to load cases"
              message={extractErrorMessage(error)}
              onRetry={() => refetch()}
            />
          )
        ) : (
          <>
            <DataTable<EmergencyResponse>
              columns={columns}
              rows={data?.items ?? []}
              getRowKey={(row) => row.id}
              onRowClick={(row) => navigate(`/hospital/cases/${row.id}`)}
              loading={isLoading}
              searchable
              searchPlaceholder="Search by incident type or ID..."
              searchFilter={(row, q) =>
                row.incident_type.toLowerCase().includes(q) ||
                row.id.toLowerCase().includes(q)
              }
              emptyState={
                <EmptyState
                  title="No cases found"
                  description={
                    statusFilter
                      ? `No emergency cases with status "${statusFilter.replace(/_/g, " ")}".`
                      : "No emergency cases are currently accessible for your hospital."
                  }
                  action={
                    statusFilter ? (
                      <button
                        type="button"
                        className="text-sm text-primary font-medium hover:underline"
                        onClick={() => {
                          setStatusFilter("");
                          setPage(1);
                        }}
                      >
                        Clear filter
                      </button>
                    ) : undefined
                  }
                />
              }
            />

            <Pagination
              page={page}
              totalPages={data?.total_pages ?? 0}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() =>
                setPage((p) => Math.min(data?.total_pages ?? p, p + 1))
              }
            />

            {data && (
              <p className="text-[12px] text-navy-secondary">
                {data.total} total case{data.total !== 1 ? "s" : ""}.
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
