export interface HospitalAvailability {
  er_beds?: number;
  icu_beds?: number;
  accepting_patients?: boolean;
  divert_status?: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  registration_identifier: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contact_number: string | null;
  capabilities: string[];
  reported_availability: HospitalAvailability;
  availability_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type HospitalRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';

export interface HospitalRequest {
  id: string;
  emergency_id: string;
  hospital_id: string;
  status: HospitalRequestStatus;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  decline_reason: string | null;
}
