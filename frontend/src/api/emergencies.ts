import { apiGet } from "./client";
import type {
  EmergencyResponse,
  EmergencyHistoryResponse,
  PaginatedResponse,
} from "./types";

const BASE = "/api/v1/emergencies";

export function listEmergencies(params?: {
  page?: number;
  page_size?: number;
  status?: string;
}): Promise<PaginatedResponse<EmergencyResponse>> {
  return apiGet<PaginatedResponse<EmergencyResponse>>(BASE, { params });
}

export function getEmergency(id: string): Promise<EmergencyResponse> {
  return apiGet<EmergencyResponse>(`${BASE}/${id}`);
}

export function getEmergencyHistory(id: string): Promise<EmergencyHistoryResponse[]> {
  return apiGet<EmergencyHistoryResponse[]>(`${BASE}/${id}/history`);
}
