/**
 * API type definitions generated from backend/openapi.json
 * Keep in sync with the backend schema.
 */

// ── Enums ─────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "HOSPITAL_STAFF" | "AMBULANCE_CREW";

export type EmergencyStatus =
  | "CREATED"
  | "ASSESSMENT_IN_PROGRESS"
  | "SEARCHING_HOSPITAL"
  | "ACCEPTANCE_PENDING"
  | "HOSPITAL_CONFIRMED"
  | "TRANSPORTING"
  | "ARRIVED"
  | "HANDOVER_COMPLETED"
  | "CANCELLED"
  | "ESCALATION_REQUIRED";

export type HospitalRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export type AmbulanceStatus =
  | "AVAILABLE"
  | "BUSY"
  | "EN_ROUTE"
  | "OUT_OF_SERVICE";

// ── Auth ──────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserResponse {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  hospital_id: string | null;
  ambulance_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Hospitals ─────────────────────────────────────────────────────

export interface HospitalResponse {
  id: string;
  name: string;
  registration_identifier: string;
  address: string;
  latitude: number;
  longitude: number;
  contact_number: string;
  capabilities: string[];
  reported_availability: Record<string, unknown>;
  availability_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HospitalCreate {
  name: string;
  registration_identifier: string;
  address: string;
  latitude: number;
  longitude: number;
  contact_number: string;
  capabilities?: string[];
  reported_availability?: Record<string, unknown>;
}

export interface HospitalUpdate {
  name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact_number?: string | null;
  capabilities?: string[] | null;
}

export interface HospitalAvailabilityUpdate {
  reported_availability: Record<string, unknown>;
}

// ── Ambulances ────────────────────────────────────────────────────

export interface AmbulanceResponse {
  id: string;
  registration_identifier: string;
  operational_status: AmbulanceStatus;
  contact_number: string | null;
  created_at: string;
  updated_at: string;
}

// ── Emergencies ───────────────────────────────────────────────────

export interface EmergencyResponse {
  id: string;
  created_by_id: string;
  incident_type: string;
  incident_description: string | null;
  patient_info: Record<string, unknown>;
  incident_latitude: number;
  incident_longitude: number;
  location_captured_at: string;
  status: EmergencyStatus;
  assigned_ambulance_id: string | null;
  confirmed_hospital_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmergencyHistoryResponse {
  id: string;
  emergency_id: string;
  event_type: string;
  actor_user_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface EmergencyCreate {
  incident_type: string;
  incident_latitude: number;
  incident_longitude: number;
  incident_description?: string | null;
  patient_info?: Record<string, unknown>;
  assigned_ambulance_id?: string | null;
  location_captured_at?: string | null;
}

// ── Hospital Requests ─────────────────────────────────────────────

export interface HospitalRequestResponse {
  id: string;
  emergency_id: string;
  hospital_id: string;
  status: HospitalRequestStatus;
  response_deadline: string;
  responded_at: string | null;
  response_reason: string | null;
  created_at: string;
}

export interface HospitalRequestDeclinePayload {
  reason?: string | null;
}

export interface ConfirmedAssignmentResponse {
  emergency_id: string;
  confirmed_hospital_id: string | null;
  confirmed_hospital_name?: string | null;
  status: string;
}

// ── Admin ─────────────────────────────────────────────────────────

export interface AdminDashboardResponse {
  total_hospitals: number;
  total_ambulances: number;
  available_ambulances: number;
  active_emergencies: number;
  emergencies_by_status: Record<string, number>;
  total_users: number;
}

// ── Common ────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}

// ── API Error shape ───────────────────────────────────────────────

export interface ApiErrorDetail {
  detail: string | ValidationError[];
}
