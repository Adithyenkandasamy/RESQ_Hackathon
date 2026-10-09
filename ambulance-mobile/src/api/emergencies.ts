import { apiClient } from './client';
import {
  Emergency,
  EmergencyCreatePayload,
  EmergencyStatus,
  EmergencySeverity,
  PatientInfo,
  EmergencyHistoryItem,
} from '../types/emergency';
import { Hospital } from '../types/hospital';
import { PaginatedResponse } from '../types/api';

function normalizeEmergency(data: any): Emergency {
  const lat = data.incident_latitude ?? data.latitude ?? null;
  const lng = data.incident_longitude ?? data.longitude ?? null;
  const desc = data.incident_description ?? data.location_description ?? null;
  const type = data.incident_type ?? data.severity_level ?? 'STANDARD';

  return {
    id: data.id,
    created_by_id: data.created_by_id,
    severity_level: type as EmergencySeverity,
    incident_type: type,
    status: data.status,
    location_description: desc,
    incident_description: desc,
    latitude: lat,
    longitude: lng,
    incident_latitude: lat,
    incident_longitude: lng,
    location_captured_at: data.location_captured_at || data.created_at || null,
    assigned_ambulance_id: data.assigned_ambulance_id || null,
    confirmed_hospital_id: data.confirmed_hospital_id || null,
    required_capabilities: data.required_capabilities || [],
    patient_info: data.patient_info || {},
    transcription_text: data.transcription?.text || data.transcription_text || null,
    clinical_entities: data.ai_extractions?.[0] || data.clinical_entities || null,
    handover_summary: data.handover_summary?.summary || data.handover_summary || null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export const EmergenciesApi = {
  async createEmergency(payload: EmergencyCreatePayload): Promise<Emergency> {
    const lat = payload.incident_latitude ?? payload.latitude ?? 0;
    const lng = payload.incident_longitude ?? payload.longitude ?? 0;
    const desc = payload.incident_description || payload.location_description || 'Emergency Scene';
    const incidentType = payload.incident_type || payload.severity_level || 'CRITICAL';

    const backendPayload: Record<string, any> = {
      incident_type: incidentType,
      incident_description: desc,
      incident_latitude: lat,
      incident_longitude: lng,
      location_captured_at: new Date().toISOString(),
      patient_info: payload.patient_info || {},
    };

    if (payload.assigned_ambulance_id) {
      backendPayload.assigned_ambulance_id = payload.assigned_ambulance_id;
    }

    const res = await apiClient<any>('/emergencies', {
      method: 'POST',
      body: backendPayload,
    });
    return normalizeEmergency(res);
  },

  async getEmergencies(page = 1, pageSize = 20): Promise<PaginatedResponse<Emergency>> {
    const res = await apiClient<PaginatedResponse<any>>(
      `/emergencies?page=${page}&page_size=${pageSize}`,
      { method: 'GET' }
    );
    return {
      ...res,
      items: (res.items || []).map(normalizeEmergency),
    };
  },

  async getEmergency(id: string): Promise<Emergency> {
    const res = await apiClient<any>(`/emergencies/${id}`, {
      method: 'GET',
    });
    return normalizeEmergency(res);
  },

  async updateStatus(id: string, status: EmergencyStatus, notes?: string): Promise<Emergency> {
    const res = await apiClient<any>(`/emergencies/${id}/status`, {
      method: 'PATCH',
      body: {
        status,
        reason: notes || undefined,
      },
    });
    return normalizeEmergency(res);
  },

  async updateLocation(id: string, latitude: number, longitude: number): Promise<Emergency> {
    const res = await apiClient<any>(`/emergencies/${id}/location`, {
      method: 'PATCH',
      body: {
        incident_latitude: latitude,
        incident_longitude: longitude,
        location_captured_at: new Date().toISOString(),
      },
    });
    return normalizeEmergency(res);
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
