import React from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { SkeletonCard } from "../../components/Skeleton";

/**
 * Hospital Dashboard placeholder — implemented in Step 3.
 */
export function HospitalDashboard() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Hospital Dashboard" subtitle="Incoming requests and active cases" />
        <SkeletonCard />
      </div>
    </AppShell>
  );
}

/**
 * Hospital Case List placeholder — implemented in Step 2.
 */
export function HospitalCaseList() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Cases" subtitle="Emergency cases assigned to your hospital" />
        <SkeletonCard />
      </div>
    </AppShell>
  );
}

/**
 * Hospital Case Detail placeholder — implemented in Step 2.
 */
export function HospitalCaseDetail() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Case Detail" />
        <SkeletonCard />
      </div>
    </AppShell>
  );
}

/**
 * Hospital Profile placeholder — implemented in Step 3.
 */
export function HospitalProfile() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Hospital Profile" subtitle="Profile and availability settings" />
        <SkeletonCard />
      </div>
    </AppShell>
  );
}
