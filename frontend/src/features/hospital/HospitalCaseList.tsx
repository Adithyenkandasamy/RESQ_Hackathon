import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonCard } from "../../components/Skeleton";
import { listEmergencies } from "../../api/emergencies";
import { getMyHospital } from "../../api/hospitals";
import type { EmergencyResponse } from "../../api/types";

export function HospitalCaseList() {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data: hospital } = useQuery({
    queryKey: ["my-hospital"],
    queryFn: getMyHospital,
  });

  const { data: emergenciesData, isLoading } = useQuery({
    queryKey: ["hospital-all-emergencies"],
    queryFn: () => listEmergencies({ page_size: 100 }),
    refetchInterval: 10000,
  });

  // Filter cases confirmed for this hospital (or all if admin)
  const allHospitalCases = (emergenciesData?.items || []).filter(
    (e: EmergencyResponse) => !hospital?.id || e.confirmed_hospital_id === hospital?.id
  );

  const filteredCases = allHospitalCases.filter((e) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "INBOUND") return ["HOSPITAL_CONFIRMED", "TRANSPORTING", "ON_SCENE"].includes(e.status);
    if (statusFilter === "ARRIVED") return e.status === "ARRIVED";
    if (statusFilter === "COMPLETED") return e.status === "HANDOVER_COMPLETED";
    return e.status === statusFilter;
  });

  return (
    <AppShell pageTitle="Hospital Cases">
      <div className="space-y-6">
        <PageHeader
          title="Assigned Emergency Cases"
          subtitle={`Clinical intake and history for ${hospital?.name || "your hospital"}`}
        />

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-outline-variant pb-3">
          {[
            { key: "ALL", label: `All Cases (${allHospitalCases.length})` },
            {
              key: "INBOUND",
              label: `Inbound / En Route (${allHospitalCases.filter((c) => ["HOSPITAL_CONFIRMED", "TRANSPORTING", "ON_SCENE"].includes(c.status)).length})`,
            },
            {
              key: "ARRIVED",
              label: `At Hospital (${allHospitalCases.filter((c) => c.status === "ARRIVED").length})`,
            },
            {
              key: "COMPLETED",
              label: `Handover Done (${allHospitalCases.filter((c) => c.status === "HANDOVER_COMPLETED").length})`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab.key
                  ? "bg-primary text-white"
                  : "bg-surface text-navy-secondary hover:bg-surface-container hover:text-navy border border-outline-variant"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Case Table / Cards */}
        {isLoading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-white p-10 text-center">
            <h3 className="text-sm font-semibold text-navy">No Cases in this Category</h3>
            <p className="mt-1 text-xs text-navy-secondary">
              When patients are confirmed or arrive at your hospital, they will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-outline-variant bg-surface text-navy-secondary uppercase tracking-wider text-[11px] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Case ID & Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Paramedic Patient Description</th>
                    <th className="px-4 py-3">Received Time</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-navy">
                  {filteredCases.map((c: EmergencyResponse) => {
                    const patientDesc =
                      (c.patient_info as any)?.condition_description ||
                      c.incident_description ||
                      "Field assessment in progress";

                    return (
                      <tr key={c.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-4 py-3 font-semibold">
                          <Link
                            to={`/hospital/cases/${c.id}`}
                            className="text-primary hover:underline block"
                          >
                            #{c.id.slice(0, 8)}
                          </Link>
                          <span className="text-navy-secondary text-[11px] block">{c.incident_type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge type="emergency" status={c.status} />
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="truncate font-medium text-navy">
                            {patientDesc}
                          </p>
                          {(c.transcription as any)?.transcript && (
                            <span className="text-[10px] text-[#006194] italic block">
                              🎙️ Voice note attached
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-navy-secondary whitespace-nowrap">
                          {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/hospital/cases/${c.id}`}
                            className="inline-flex items-center rounded border border-outline-variant bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-container"
                          >
                            View Case Record →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
