import React from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { BackendEndpointRequired } from "../../components/ErrorState";
import { SkeletonCard } from "../../components/Skeleton";

export { AdminDashboard } from "./Dashboard";

/**
 * Admin Hospitals page placeholder — implemented in Step 4.
 */
export function AdminHospitals() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Hospitals" subtitle="Registered hospital directory" />
        <SkeletonCard />
      </div>
    </AppShell>
  );
}

/**
 * Admin Ambulances page — backend list/create/edit endpoints are missing.
 */
export function AdminAmbulances() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Ambulances" subtitle="Fleet management" />
        <BackendEndpointRequired feature="Ambulance list, create, edit, and delete" />
      </div>
    </AppShell>
  );
}

/**
 * Admin Users page — backend user management endpoints are missing.
 */
export function AdminUsers() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Users" subtitle="User management" />
        <BackendEndpointRequired feature="User list, create, and deactivate" />
      </div>
    </AppShell>
  );
}

/**
 * Admin Emergencies page placeholder — implemented in Step 4.
 */
export function AdminEmergencies() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Emergencies" subtitle="All emergency incidents" />
        <SkeletonCard />
      </div>
    </AppShell>
  );
}
