import { apiGet, apiPost } from "./client";
import type {
  AdminDashboardResponse,
  HospitalRegistrationDecision,
  HospitalRegistrationResponse,
  HospitalStatus,
} from "./types";

export function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return apiGet<AdminDashboardResponse>("/api/v1/admin/dashboard");
}

export function listHospitalRegistrations(
  params?: { status?: HospitalStatus }
): Promise<HospitalRegistrationResponse[]> {
  return apiGet<HospitalRegistrationResponse[]>("/api/v1/admin/hospital-registrations", {
    params,
  });
}

export function approveHospitalRegistration(
  hospitalId: string
): Promise<HospitalRegistrationResponse> {
  return apiPost<HospitalRegistrationResponse>(
    `/api/v1/admin/hospital-registrations/${hospitalId}/approve`
  );
}

export function rejectHospitalRegistration(
  hospitalId: string,
  payload?: HospitalRegistrationDecision
): Promise<HospitalRegistrationResponse> {
  return apiPost<HospitalRegistrationResponse>(
    `/api/v1/admin/hospital-registrations/${hospitalId}/reject`,
    payload
  );
}