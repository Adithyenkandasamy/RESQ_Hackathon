import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/Skeleton";
import { useToast } from "../../components/Toast";
import {
  getMyHospital,
  updateMyHospital,
  updateHospitalAvailability,
} from "../../api/hospitals";

export function HospitalProfile() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const { data: hospital, isLoading } = useQuery({
    queryKey: ["my-hospital"],
    queryFn: getMyHospital,
  });

  const [operationalStatus, setOperationalStatus] = useState<string>("OPEN");
  const [icuAvailable, setIcuAvailable] = useState<number>(0);
  const [icuTotal, setIcuTotal] = useState<number>(0);
  const [genAvailable, setGenAvailable] = useState<number>(0);
  const [genTotal, setGenTotal] = useState<number>(0);
  const [otAvailable, setOtAvailable] = useState<number>(0);
  const [otTotal, setOtTotal] = useState<number>(0);

  useEffect(() => {
    if (hospital) {
      const avail = (hospital.reported_availability || {}) as Record<string, any>;
      setOperationalStatus(avail.operational_status || "OPEN");
      setIcuAvailable(avail.icu_beds_available ?? 12);
      setIcuTotal(avail.icu_beds_total ?? 15);
      setGenAvailable(avail.general_beds_available ?? 40);
      setGenTotal(avail.general_beds_total ?? 50);
      setOtAvailable(avail.operation_theatres_available ?? 3);
      setOtTotal(avail.operation_theatres_total ?? 4);
    }
  }, [hospital]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const existing = (hospital?.reported_availability || {}) as Record<string, any>;
      await updateHospitalAvailability({
        reported_availability: {
          ...existing,
          operational_status: operationalStatus,
          icu_beds_available: icuAvailable,
          icu_beds_total: icuTotal,
          general_beds_available: genAvailable,
          general_beds_total: genTotal,
          operation_theatres_available: otAvailable,
          operation_theatres_total: otTotal,
        },
      });
    },
    onSuccess: () => {
      addToast("Hospital capacity and operational status updated!", "success");
      queryClient.invalidateQueries({ queryKey: ["my-hospital"] });
    },
    onError: (err: any) => {
      addToast(err.message || "Failed to update hospital profile.", "error");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <AppShell pageTitle="Hospital Profile">
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title={hospital?.name || "Hospital Profile"}
          subtitle="Configure hospital capacity, triage intake status, and trauma capabilities."
        />

        {isLoading ? (
          <SkeletonCard />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Facility Details (Read-only metadata) */}
            <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-navy">
                Hospital Identification & Trauma Accreditation
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-navy-secondary block">Facility Name</span>
                  <p className="font-bold text-navy mt-0.5">{hospital?.name}</p>
                </div>
                <div>
                  <span className="font-semibold text-navy-secondary block">Accredited Capabilities</span>
                  <p className="font-bold text-navy mt-0.5">{hospital?.capabilities?.join(", ") || "Trauma, Emergency, ICU"}</p>
                </div>
                <div>
                  <span className="font-semibold text-navy-secondary block">Contact Number</span>
                  <p className="font-bold text-navy mt-0.5">{hospital?.contact_number || "Emergency Desk"}</p>
                </div>
              </div>
            </div>

            {/* Operational Intake Status */}
            <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-navy">
                Operational Intake Status
              </h2>
              <p className="text-xs text-navy-secondary">
                Setting your status to DIVERTING temporarily routes incoming emergencies to other trauma centers in the system.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {[
                  { key: "OPEN", label: "OPEN FOR ADMISSIONS", desc: "Accepting inbound trauma and ambulances" },
                  { key: "AT_CAPACITY", label: "AT CAPACITY", desc: "ICU / Emergency department near limit" },
                  { key: "DIVERTING", label: "DIVERTING (OVERLOAD)", desc: "Divert non-critical emergencies to other centers" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setOperationalStatus(s.key)}
                    className={`flex-1 min-w-[200px] text-left rounded-md p-3 border text-xs transition-all ${
                      operationalStatus === s.key
                        ? s.key === "OPEN"
                          ? "border-[#16A34A] bg-[#DCFCE7]/40 text-[#16A34A]"
                          : s.key === "AT_CAPACITY"
                          ? "border-[#D97706] bg-[#FEF3C7]/40 text-[#D97706]"
                          : "border-[#ba1a1a] bg-[#FEE2E2]/40 text-[#ba1a1a]"
                        : "border-outline-variant bg-surface text-navy-secondary hover:bg-surface-container"
                    }`}
                  >
                    <span className="font-bold block">{s.label}</span>
                    <span className="text-[11px] opacity-80 mt-1 block">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Beds & Operating Theatre Capacity */}
            <div className="rounded-lg border border-outline-variant bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-navy">
                Real-Time Bed & OT Availability
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* ICU Beds */}
                <div className="rounded border border-outline-variant bg-surface p-3 space-y-2">
                  <span className="font-bold text-navy block">Intensive Care (ICU)</span>
                  <div>
                    <label className="text-[11px] text-navy-secondary block">Available Beds</label>
                    <input
                      type="number"
                      min={0}
                      value={icuAvailable}
                      onChange={(e) => setIcuAvailable(Number(e.target.value))}
                      className="w-full mt-1 rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-navy font-semibold focus:outline-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-navy-secondary block">Total Capacity</label>
                    <input
                      type="number"
                      min={0}
                      value={icuTotal}
                      onChange={(e) => setIcuTotal(Number(e.target.value))}
                      className="w-full mt-1 rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-navy font-semibold focus:outline-primary"
                    />
                  </div>
                </div>

                {/* General Beds */}
                <div className="rounded border border-outline-variant bg-surface p-3 space-y-2">
                  <span className="font-bold text-navy block">General Inpatient Beds</span>
                  <div>
                    <label className="text-[11px] text-navy-secondary block">Available Beds</label>
                    <input
                      type="number"
                      min={0}
                      value={genAvailable}
                      onChange={(e) => setGenAvailable(Number(e.target.value))}
                      className="w-full mt-1 rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-navy font-semibold focus:outline-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-navy-secondary block">Total Capacity</label>
                    <input
                      type="number"
                      min={0}
                      value={genTotal}
                      onChange={(e) => setGenTotal(Number(e.target.value))}
                      className="w-full mt-1 rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-navy font-semibold focus:outline-primary"
                    />
                  </div>
                </div>

                {/* Operating Theatres */}
                <div className="rounded border border-outline-variant bg-surface p-3 space-y-2">
                  <span className="font-bold text-navy block">Operation Theatres (OT)</span>
                  <div>
                    <label className="text-[11px] text-navy-secondary block">Available Suites</label>
                    <input
                      type="number"
                      min={0}
                      value={otAvailable}
                      onChange={(e) => setOtAvailable(Number(e.target.value))}
                      className="w-full mt-1 rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-navy font-semibold focus:outline-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-navy-secondary block">Total Suites</label>
                    <input
                      type="number"
                      min={0}
                      value={otTotal}
                      onChange={(e) => setOtTotal(Number(e.target.value))}
                      className="w-full mt-1 rounded border border-outline-variant bg-white px-2.5 py-1.5 text-xs text-navy font-semibold focus:outline-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? "Updating..." : "Save Hospital Capacity"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
