import { apiGet, apiPost, apiPatch } from "./client";
import type {
  HospitalResponse,
  HospitalCreate,
  HospitalUpdate,
  HospitalAvailabilityUpdate,
  PaginatedResponse,
} from "./types";

const BASE = "/api/v1/hospitals";

export function listHospitals(params?: {
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<HospitalResponse>> {
  return apiGet<PaginatedResponse<HospitalResponse>>(BASE, { params });
}

export function createHospital(payload: HospitalCreate): Promise<HospitalResponse> {
  return apiPost<HospitalResponse>(BASE, payload);
}

export function getMyHospital(): Promise<HospitalResponse> {
  return apiGet<HospitalResponse>(`${BASE}/me`);
}

export function updateMyHospital(payload: HospitalUpdate): Promise<HospitalResponse> {
  return apiPatch<HospitalResponse>(`${BASE}/me`, payload);
}

export function updateHospitalAvailability(
  payload: HospitalAvailabilityUpdate
): Promise<HospitalResponse> {
  return apiPatch<HospitalResponse>(`${BASE}/me/availability`, payload);
}
