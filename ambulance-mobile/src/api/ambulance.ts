import { apiClient } from './client';
import { Ambulance, AmbulanceStatus } from '../types/ambulance';

export const AmbulanceApi = {
  async getCurrentAmbulance(): Promise<Ambulance> {
    return apiClient<Ambulance>('/ambulances/me', {
      method: 'GET',
    });
  },

  async updateAvailability(status: AmbulanceStatus): Promise<Ambulance> {
    return apiClient<Ambulance>('/ambulances/me/availability', {
      method: 'PATCH',
      body: { operational_status: status },
    });
  },
};
