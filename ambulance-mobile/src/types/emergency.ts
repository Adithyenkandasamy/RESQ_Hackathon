export type EmergencySeverity = 'CRITICAL' | 'URGENT' | 'STANDARD';

export type EmergencyStatus =
  | 'CREATED'
  | 'MATCHING_IN_PROGRESS'
  | 'HOSPITAL_ASSIGNED'
  | 'DISPATCHED'
  | 'EN_ROUTE_SCENE'
  | 'ON_SCENE'
  | 'EN_ROUTE_HOSPITAL'
  | 'AT_HOSPITAL'
  | 'HANDOVER_COMPLETED'
  | 'CANCELLED';

export interface PatientInfo {
  name?: string;
  age?: number;
  gender?: string;
  chief_complaint?: string;
  symptoms?: string[];
  consciousness?: string;
  breathing?: string;
  blood_pressure?: string;
  heart_rate?: number;
  spo2?: number;
  allergies?: string[];
  medical_history?: string[];
  transport_priority?: string;
  [key: string]: unknown;
}

export interface Emergency {
  id: string;
  created_by_id: string;
  severity_level: EmergencySeverity;
  status: EmergencyStatus;
  location_description: string | null;
  latitude: number | null;
  longitude: number | null;
  assigned_ambulance_id: string | null;
  confirmed_hospital_id: string | null;
  required_capabilities: string[];
  patient_info: PatientInfo;
  transcription_text: string | null;
  clinical_entities: Record<string, unknown> | null;
  handover_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmergencyCreatePayload {
  severity_level: EmergencySeverity;
  location_description?: string;
  latitude?: number;
  longitude?: number;
  assigned_ambulance_id?: string;
  required_capabilities?: string[];
  patient_info?: PatientInfo;
}

export interface StatusTransitionPayload {
  status: EmergencyStatus;
  notes?: string;
}

export interface LocationUpdatePayload {
  latitude: number;
  longitude: number;
}

export interface PatientUpdatePayload {
  patient_info: PatientInfo;
}

export interface HandoverConfirmPayload {
  crew_notes?: string;
}

export interface EmergencyHistoryItem {
  id: string;
  emergency_id: string;
  from_status: EmergencyStatus | null;
  to_status: EmergencyStatus;
  changed_by_id: string | null;
  notes: string | null;
  created_at: string;
}
