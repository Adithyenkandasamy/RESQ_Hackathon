import React from "react";
import { AppShell } from "../../components/AppShell";
import { PageHeader } from "../../components/PageHeader";
import { Skeleton, SkeletonCard } from "../../components/Skeleton";

/**
 * Admin Dashboard placeholder — implemented in Step 4.
 */
export function AdminDashboard() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Operational overview"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonCard />
      </div>
    </AppShell>
  );
}
