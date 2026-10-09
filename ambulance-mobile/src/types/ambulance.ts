export type AmbulanceStatus = 'AVAILABLE' | 'BUSY' | 'EN_ROUTE' | 'OUT_OF_SERVICE';

export interface Ambulance {
  id: string;
  registration_identifier: string;
  contact_number: string | null;
  operational_status: AmbulanceStatus;
  created_at: string;
  updated_at: string;
}

export interface AmbulanceAvailabilityUpdate {
  operational_status: AmbulanceStatus;
}
