/**
 * AdmissionRequestPanel
 *
 * Displays the hospital request card for the current hospital on a case detail page.
 * Shows Accept / Decline actions only when:
 *   - A request exists for the current hospital
 *   - The request status is PENDING
 * Handles 409 Conflict gracefully, refetching authoritative state.
 *
 * Does NOT display or offer actions for other hospitals' requests.
 */

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { StatusBadge } from "../../components/StatusBadge";
import { useToast } from "../../components/Toast";
import { acceptHospitalRequest, declineHospitalRequest } from "../../api/hospitalRequests";
import { extractErrorMessage } from "../../api/client";
import type { HospitalRequestResponse } from "../../api/types";

interface AdmissionRequestPanelProps {
  request: HospitalRequestResponse;
  emergencyId: string;
}

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

export function AdmissionRequestPanel({
  request,
  emergencyId,
}: AdmissionRequestPanelProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({
      queryKey: ["emergency", emergencyId],
    });
    queryClient.invalidateQueries({
      queryKey: ["emergencyRequests", emergencyId],
    });
    queryClient.invalidateQueries({
      queryKey: ["hospitalRequest", request.id],
    });
    queryClient.invalidateQueries({
      queryKey: ["emergencies", "hospital"],
    });
  };

  const acceptMutation = useMutation({
    mutationFn: () => acceptHospitalRequest(request.id),
    onSuccess: () => {
      addToast(
        "Admission request accepted. Your hospital has been confirmed as the destination.",
        "success"
      );
      invalidateAll();
    },
    onError: (error: unknown) => {
      const httpStatus = (error as { response?: { status?: number } })?.response
        ?.status;
      if (httpStatus === 409) {
        addToast(
          "This emergency has already been accepted by another hospital. Refreshing case data.",
          "warning",
          6000
        );
      } else {
        addToast(
          `Accept failed: ${extractErrorMessage(error)}`,
          "error"
        );
      }
      // Always refetch after any error to show authoritative state
      invalidateAll();
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => declineHospitalRequest(request.id),
    onSuccess: () => {
      addToast("Admission request declined.", "info");
      invalidateAll();
    },
    onError: (error: unknown) => {
      addToast(
        `Decline failed: ${extractErrorMessage(error)}`,
        "error"
      );
      invalidateAll();
    },
  });

  const isPending = request.status === "PENDING";
  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <>
      <section
        aria-labelledby="admission-request-heading"
        className="rounded-md border border-outline-variant bg-white p-4 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2
            id="admission-request-heading"
            className="text-[14px] font-semibold text-navy"
          >
            Admission Request
          </h2>
          <StatusBadge type="request" status={request.status} />
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
              Request ID
            </dt>
            <dd className="text-[12px] font-mono text-navy mt-0.5" title={request.id}>
              {request.id.slice(0, 8).toUpperCase()}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
              Response deadline
            </dt>
            <dd className="text-[13px] text-navy mt-0.5">
              {formatDateTime(request.response_deadline)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
              Responded at
            </dt>
            <dd className="text-[13px] text-navy mt-0.5">
              {formatDateTime(request.responded_at)}
            </dd>
          </div>
          {request.response_reason && (
            <div className="col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-navy-secondary">
                Response reason
              </dt>
              <dd className="text-[13px] text-navy mt-0.5">
                {request.response_reason}
              </dd>
            </div>
          )}
        </dl>

        {/* Action buttons — only visible when request is PENDING */}
        {isPending && (
          <div className="flex gap-2 pt-1 border-t border-outline-variant">
            <button
              type="button"
              id="accept-request-btn"
              onClick={() => acceptMutation.mutate()}
              disabled={isBusy}
              aria-busy={acceptMutation.isPending}
              className="rounded px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              {acceptMutation.isPending ? "Accepting…" : "Accept"}
            </button>
            <button
              type="button"
              id="decline-request-btn"
              onClick={() => setShowDeclineDialog(true)}
              disabled={isBusy}
              className="rounded px-4 py-2 text-sm font-medium border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#FFF5F5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ba1a1a] focus-visible:ring-offset-1"
            >
              {declineMutation.isPending ? "Declining…" : "Decline"}
            </button>
          </div>
        )}

        {/* Non-actionable states */}
        {!isPending && request.status === "ACCEPTED" && (
          <p className="text-[13px] text-[#16A34A] font-medium pt-1 border-t border-outline-variant">
            Your hospital has accepted this admission request.
          </p>
        )}
        {!isPending && request.status === "DECLINED" && (
          <p className="text-[13px] text-navy-secondary pt-1 border-t border-outline-variant">
            This request was declined.
          </p>
        )}
        {!isPending && request.status === "EXPIRED" && (
          <p className="text-[13px] text-[#D97706] font-medium pt-1 border-t border-outline-variant">
            This request has expired.
          </p>
        )}
        {!isPending && request.status === "CANCELLED" && (
          <p className="text-[13px] text-navy-secondary pt-1 border-t border-outline-variant">
            This request has been cancelled — another hospital was confirmed.
          </p>
        )}
      </section>

      <ConfirmDialog
        open={showDeclineDialog}
        title="Decline admission request"
        description="Are you sure you want to decline this emergency admission request? This action cannot be undone. The system will continue dispatching requests to other hospitals."
        confirmLabel="Decline request"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          setShowDeclineDialog(false);
          declineMutation.mutate();
        }}
        onCancel={() => setShowDeclineDialog(false)}
      />
    </>
  );
}
