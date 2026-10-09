/**
 * Hospital feature barrel.
 *
 * Implements:
 *   - HospitalDashboard   (/hospital/dashboard)
 *   - HospitalCaseList    (/hospital/cases)
 *   - HospitalCaseDetail  (/hospital/cases/:id)
 *
 * HospitalProfile remains as profile stub.
 */

import React from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/Skeleton";

export { HospitalDashboard } from "./Dashboard";
export { HospitalCaseList } from "./CaseList";
export { HospitalCaseDetail } from "./CaseDetail";

/**
 * Hospital Profile placeholder.
 */
export function HospitalProfile() {
  return (
    <AppShell pageTitle="Hospital Profile">
      <div className="space-y-6">
        <PageHeader title="Hospital Profile" subtitle="Profile and availability settings" />
        <SkeletonCard />
      </div>
    </AppShell>
  );
}
