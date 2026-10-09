import { apiClient } from './client';
import {
  Emergency,
  EmergencyCreatePayload,
  EmergencyStatus,
  PatientInfo,
  EmergencyHistoryItem,
} from '../types/emergency';
import { Hospital } from '../types/hospital';
import { PaginatedResponse } from '../types/api';

export const EmergenciesApi = {
  async createEmergency(payload: EmergencyCreatePayload): Promise<Emergency> {
    return apiClient<Emergency>('/emergencies', {
      method: 'POST',
      body: payload,
    });
  },

  async getEmergencies(page = 1, pageSize = 20): Promise<PaginatedResponse<Emergency>> {
    return apiClient<PaginatedResponse<Emergency>>(
      `/emergencies?page=${page}&page_size=${pageSize}`,
      { method: 'GET' }
    );
  },

  async getEmergency(id: string): Promise<Emergency> {
    return apiClient<Emergency>(`/emergencies/${id}`, {
      method: 'GET',
    });
  },

  async updateStatus(id: string, status: EmergencyStatus, notes?: string): Promise<Emergency> {
    return apiClient<Emergency>(`/emergencies/${id}/status`, {
      method: 'PATCH',
      body: { status, notes },
    });
  },

  async updateLocation(id: string, latitude: number, longitude: number): Promise<Emergency> {
    return apiClient<Emergency>(`/emergencies/${id}/location`, {
      method: 'PATCH',
      body: { latitude, longitude },
    });
  },

  async updatePatientInfo(id: string, patientInfo: PatientInfo): Promise<Emergency> {
    return apiClient<Emergency>(`/emergencies/${id}/patient`, {
      method: 'PATCH',
      body: { patient_info: patientInfo },
    });
  },

  async getHistory(id: string): Promise<EmergencyHistoryItem[]> {
    return apiClient<EmergencyHistoryItem[]>(`/emergencies/${id}/history`, {
      method: 'GET',
    });
  },

  async triggerMatching(id: string): Promise<{ matched_candidates_count: number; message: string }> {
    return apiClient<{ matched_candidates_count: number; message: string }>(
      `/emergencies/${id}/match-hospitals`,
      { method: 'POST' }
    );
  },

  async getConfirmedDestination(id: string): Promise<Hospital> {
    return apiClient<Hospital>(`/emergencies/${id}/destination`, {
      method: 'GET',
    });
  },

  async uploadAudio(id: string, audioFile: { uri: string; name: string; type: string }): Promise<{
    emergency_id: string;
    transcription_text: string;
  }> {
    const formData = new FormData();
    formData.append('file', {
      uri: audioFile.uri,
      name: audioFile.name,
      type: audioFile.type,
    } as any);

    return apiClient<{ emergency_id: string; transcription_text: string }>(
      `/emergencies/${id}/transcription`,
      {
        method: 'POST',
        body: formData,
        isMultipart: true,
      }
    );
  },

  async extractEntities(id: string, transcriptionText: string): Promise<{
    emergency_id: string;
    extractions: Record<string, unknown>;
  }> {
    return apiClient<{ emergency_id: string; extractions: Record<string, unknown> }>(
      `/emergencies/${id}/ai/extract`,
      {
        method: 'POST',
        body: { transcription_text: transcriptionText },
      }
    );
  },

  async verifyExtractions(id: string, verifiedExtractions: Record<string, unknown>): Promise<Emergency> {
    return apiClient<Emergency>(`/emergencies/${id}/ai/verify-extractions`, {
      method: 'POST',
      body: { verified_extractions: verifiedExtractions },
    });
  },

  async draftHandoverSummary(id: string): Promise<{
    emergency_id: string;
    handover_summary: string;
  }> {
    return apiClient<{ emergency_id: string; handover_summary: string }>(
      `/emergencies/${id}/ai/handover-summary`,
      { method: 'POST' }
    );
  },

  async confirmHandover(id: string, notes?: string): Promise<Emergency> {
    return apiClient<Emergency>(`/emergencies/${id}/handover/confirm`, {
      method: 'POST',
      body: { crew_notes: notes },
    });
  },

  async getFirstAidGuidance(id: string, condition: string): Promise<{
    emergency_id: string;
    protocol_name: string;
    steps: string[];
    critical_warnings: string[];
  }> {
    return apiClient<{
      emergency_id: string;
      protocol_name: string;
      steps: string[];
      critical_warnings: string[];
    }>(`/emergencies/${id}/ai/first-aid`, {
      method: 'POST',
      body: { condition },
    });
  },
};
