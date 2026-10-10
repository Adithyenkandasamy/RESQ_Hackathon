import { apiClient, API_V1_URL, ApiError } from './client';
import { SecureStorageService } from '../services/secureStorage';
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

/**
 * Upload an audio file using XMLHttpRequest — React Native Android's XHR
 * natively supports file:// URIs in FormData, avoiding the OkHttp
 * 'Unsupported FormDataPart implementation' error that fetch() triggers.
 */
async function uploadAudioFile(
  endpoint: string,
  audioFile: { uri: string; name: string; type: string },
): Promise<any> {
  const token = await SecureStorageService.getToken();
  const url = endpoint.startsWith('http') ? endpoint : `${API_V1_URL}${endpoint}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({ transcript: '', transcription_text: '' });
        }
      } else {
        let msg = `Request failed with status ${xhr.status}`;
        try {
          const data = JSON.parse(xhr.responseText);
          msg = data?.detail || data?.message || msg;
        } catch { /* ignore */ }
        reject(new ApiError(msg, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError('Network error uploading audio', 0));
    xhr.ontimeout = () => reject(new ApiError('Audio upload timed out', 408));
    xhr.timeout = 60000;

    const formData = new FormData();
    // React Native XHR accepts { uri, name, type } objects natively
    formData.append('file', { uri: audioFile.uri, name: audioFile.name, type: audioFile.type } as any);
    xhr.send(formData);
  });
}

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
    ambulance_latitude: data.ambulance_latitude ?? null,
    ambulance_longitude: data.ambulance_longitude ?? null,
    ambulance_location_updated_at: data.ambulance_location_updated_at ?? null,
    hospital_name: data.hospital_name ?? null,
    hospital_latitude: data.hospital_latitude ?? null,
    hospital_longitude: data.hospital_longitude ?? null,
    ai_processing_status: data.ai_processing_status ?? 'PENDING',
    location_captured_at: data.location_captured_at || data.created_at || null,
    assigned_ambulance_id: data.assigned_ambulance_id || null,
    confirmed_hospital_id: data.confirmed_hospital_id || null,
    required_capabilities: data.required_capabilities || [],
    patient_info: data.patient_info || {},
    transcription_text: data.transcription?.text || data.transcription?.transcript || null,
    clinical_entities: data.ai_extractions?.[0] || data.clinical_entities || null,
    handover_summary:
      data.handover_summary?.summary ||
      data.handover_summary?.incident_overview ||
      (typeof data.handover_summary === 'string' ? data.handover_summary : null),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export const EmergenciesApi = {
  async createEmergency(payload: EmergencyCreatePayload): Promise<Emergency> {
    const lat = payload.incident_latitude ?? payload.latitude ?? null;
    const lng = payload.incident_longitude ?? payload.longitude ?? null;
    const desc = payload.incident_description || payload.location_description || 'Emergency Scene';
    const incidentType = payload.incident_type || payload.severity_level || 'CRITICAL';

    const backendPayload: Record<string, any> = {
      incident_type: incidentType,
      incident_description: desc,
      patient_info: payload.patient_info || {},
    };

    if (lat !== null && lng !== null) {
      backendPayload.incident_latitude = lat;
      backendPayload.incident_longitude = lng;
      backendPayload.location_captured_at = new Date().toISOString();
    }

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

  async uploadAudio(id: string, audioFile?: { uri: string; name: string; type: string }): Promise<{
    emergency_id: string;
    transcript: string;
    transcription_text?: string;
  }> {
    if (!audioFile?.uri || (!audioFile.uri.startsWith('file:') && !audioFile.uri.startsWith('content:'))) {
      // No valid local file — just POST empty to trigger any server-side default handling
      return apiClient<{ emergency_id: string; transcript: string; transcription_text?: string }>(
        `/emergencies/${id}/transcription`,
        { method: 'POST' }
      );
    }
    // Use XHR to avoid Android OkHttp FormData rejection
    return uploadAudioFile(`/emergencies/${id}/transcription`, {
      uri: audioFile.uri,
      name: audioFile.name || 'patient_voice_note.m4a',
      type: audioFile.type || 'audio/m4a',
    });
  },

  directTranscribe: async function(audioFile?: { uri: string; name: string; type: string }): Promise<{
    transcript: string;
    transcription_text?: string;
  }> {
    if (!audioFile?.uri || (!audioFile.uri.startsWith('file:') && !audioFile.uri.startsWith('content:'))) {
      // No audio file — return empty so UI shows the tag fallback
      return { transcript: '', transcription_text: '' };
    }
    // Use XHR to avoid Android OkHttp FormData rejection
    return uploadAudioFile('/emergencies/transcribe-audio', {
      uri: audioFile.uri,
      name: audioFile.name || 'patient_voice_note.m4a',
      type: audioFile.type || 'audio/m4a',
    });
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

  async getFirstAidGuidance(id: string, condition?: string): Promise<{
    protocol_title: string;
    protocol_name: string;
    guidance_steps: string[];
    steps: string[];
    critical_precautions: string[];
    critical_warnings: string[];
    disclaimer?: string;
  }> {
    const res = await apiClient<any>(`/emergencies/${id}/ai/first-aid`, {
      method: 'POST',
    });
    const steps = res.guidance_steps || res.steps || [];
    const precautions = res.critical_precautions || res.critical_warnings || [];
    const title = res.protocol_title || res.protocol_name || 'Clinical Care Protocol';
    return {
      protocol_title: title,
      protocol_name: title,
      guidance_steps: steps,
      steps: steps,
      critical_precautions: precautions,
      critical_warnings: precautions,
      disclaimer: res.disclaimer,
    };
  },
};
