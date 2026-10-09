/**
 * PatientInfoSection
 *
 * Safely renders the patient_info JSON object returned by the backend.
 * - Handles unknown/additional keys without crashing.
 * - Renders null / missing values as "Not provided".
 * - Labels are humanized.
 * - Never logs patient data to the console.
 * - Content is explicitly labeled "Reported information".
 */

import React from "react";

interface PatientInfoSectionProps {
  patientInfo: Record<string, unknown> | null | undefined;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "[unrenderable value]";
    }
  }
  return String(value);
}

export function PatientInfoSection({ patientInfo }: PatientInfoSectionProps) {
  const isEmpty =
    !patientInfo || Object.keys(patientInfo).length === 0;

  return (
    <section aria-labelledby="patient-info-heading">
      <div className="flex items-baseline gap-2 mb-3">
        <h2
          id="patient-info-heading"
          className="text-[14px] font-semibold text-navy"
        >
          Patient &amp; Vitals
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A] rounded-full px-2 py-0.5">
          Reported information
        </span>
      </div>

      {isEmpty ? (
        <p className="text-[13px] text-navy-secondary italic">
          No patient information has been reported yet.
        </p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {Object.entries(patientInfo!).map(([key, value]) => (
            <div key={key} className="flex flex-col gap-0.5">
              <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-navy-secondary">
                {humanizeKey(key)}
              </dt>
              <dd className="text-[13px] text-navy whitespace-pre-wrap break-words">
                {renderValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
