export type UserRole = 'ADMIN' | 'HOSPITAL_STAFF' | 'AMBULANCE_CREW';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  hospital_id: string | null;
  ambulance_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface CrewRegisterPayload {
  email: string;
  password: string;
  ambulance_identifier: string;
  contact_number?: string;
}
