import { apiGet, apiPost } from "./client";
import type {
  HospitalRequestResponse,
  HospitalRequestDeclinePayload,
  ConfirmedAssignmentResponse,
} from "./types";

const BASE = "/api/v1/hospital-requests";

export function listHospitalRequests(params?: {
  status?: string;
}): Promise<HospitalRequestResponse[]> {
  return apiGet<HospitalRequestResponse[]>(BASE, { params });
}

export function getHospitalRequest(id: string): Promise<HospitalRequestResponse> {
  return apiGet<HospitalRequestResponse>(`${BASE}/${id}`);
}

export function acceptHospitalRequest(id: string): Promise<HospitalRequestResponse> {
  return apiPost<HospitalRequestResponse>(`${BASE}/${id}/accept`);
}

export function declineHospitalRequest(
  id: string,
  payload?: HospitalRequestDeclinePayload
): Promise<HospitalRequestResponse> {
  return apiPost<HospitalRequestResponse>(`${BASE}/${id}/decline`, payload ?? {});
}

export function getEmergencyRequests(emergencyId: string): Promise<HospitalRequestResponse[]> {
  return apiGet<HospitalRequestResponse[]>(
    `/api/v1/emergencies/${emergencyId}/requests`
  );
}

export function getEmergencyDestination(
  emergencyId: string
): Promise<ConfirmedAssignmentResponse> {
  return apiGet<ConfirmedAssignmentResponse>(
    `/api/v1/emergencies/${emergencyId}/destination`
  );
}
