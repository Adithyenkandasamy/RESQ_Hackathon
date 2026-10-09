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

  async updateLocation(latitude: number, longitude: number): Promise<Ambulance> {
    return apiClient<Ambulance>('/ambulances/me/location', {
      method: 'PATCH',
      body: {
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      },
    });
  },
};
