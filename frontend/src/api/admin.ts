import { apiGet } from "./client";
import type { AdminDashboardResponse } from "./types";

export function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return apiGet<AdminDashboardResponse>("/api/v1/admin/dashboard");
}
