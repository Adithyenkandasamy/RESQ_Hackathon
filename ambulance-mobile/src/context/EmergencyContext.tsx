import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Emergency, EmergencyCreatePayload, EmergencyStatus } from '../types/emergency';
import { Hospital } from '../types/hospital';
import { EmergenciesApi } from '../api/emergencies';
import { socketService } from '../services/socket';
import { useAuth } from './AuthContext';

interface EmergencyContextType {
  activeEmergency: Emergency | null;
  confirmedHospital: Hospital | null;
  isLoading: boolean;
  refreshActiveEmergency: () => Promise<void>;
  createEmergency: (payload: EmergencyCreatePayload) => Promise<Emergency>;
  updateStatus: (status: EmergencyStatus, notes?: string) => Promise<void>;
  completeHandover: (notes?: string) => Promise<void>;
  clearActiveEmergency: () => void;
}

const EmergencyContext = createContext<EmergencyContextType | undefined>(undefined);

export const EmergencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, ambulance } = useAuth();
  const [activeEmergency, setActiveEmergency] = useState<Emergency | null>(null);
  const [confirmedHospital, setConfirmedHospital] = useState<Hospital | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchConfirmedHospital = useCallback(async (emergencyId: string) => {
    try {
      const hosp = await EmergenciesApi.getConfirmedDestination(emergencyId);
      setConfirmedHospital(hosp);
    } catch {
      setConfirmedHospital(null);
    }
  }, []);

  const refreshActiveEmergency = useCallback(async () => {
    if (!ambulance) {
      setActiveEmergency(null);
      setConfirmedHospital(null);
      return;
    }

    try {
      setIsLoading(true);
      const res = await EmergenciesApi.getEmergencies(1, 20);
      const ongoing = res.items.find(
        (e) =>
          e.assigned_ambulance_id === ambulance.id &&
          e.status !== 'HANDOVER_COMPLETED' &&
          e.status !== 'CANCELLED'
      );

      if (ongoing) {
        setActiveEmergency(ongoing);
        socketService.setEmergencyRoom(ongoing.id);
        if (ongoing.confirmed_hospital_id) {
          await fetchConfirmedHospital(ongoing.id);
        } else {
          setConfirmedHospital(null);
        }
      } else {
        setActiveEmergency(null);
        setConfirmedHospital(null);
        socketService.setEmergencyRoom(null);
      }
    } catch (e) {
      console.warn('Failed to refresh active emergency:', e);
    } finally {
      setIsLoading(false);
    }
  }, [ambulance, fetchConfirmedHospital]);

  useEffect(() => {
    if (user && ambulance) {
      refreshActiveEmergency();
    }
  }, [user, ambulance, refreshActiveEmergency]);

  // Listen for real-time Socket.IO updates
  useEffect(() => {
    const handleHospitalAssigned = async (data: any) => {
      // Always refresh when we get this event - even if activeEmergency is stale
      await refreshActiveEmergency();
    };

    const handleStatusUpdated = async (data: any) => {
      if (activeEmergency) {
        await refreshActiveEmergency();
      }
    };

    socketService.on('hospital.assigned', handleHospitalAssigned);
    socketService.on('emergency.status.updated', handleStatusUpdated);

    return () => {
      socketService.off('hospital.assigned', handleHospitalAssigned);
      socketService.off('emergency.status.updated', handleStatusUpdated);
    };
  }, [activeEmergency, refreshActiveEmergency]);

  // Polling fallback: refresh every 5s while an emergency is active to pick up
  // hospital acceptance even when socket events are missed.
  useEffect(() => {
    if (!activeEmergency) return;
    // If hospital is not yet confirmed, poll frequently to catch the acceptance
    if (activeEmergency.confirmed_hospital_id) return;
    const interval = setInterval(() => {
      refreshActiveEmergency();
    }, 5000);
    return () => clearInterval(interval);
  }, [activeEmergency?.id, activeEmergency?.confirmed_hospital_id, refreshActiveEmergency]);

  const createEmergency = async (payload: EmergencyCreatePayload): Promise<Emergency> => {
    setIsLoading(true);
    try {
      const payloadWithAmbulance = {
        ...payload,
        assigned_ambulance_id: ambulance?.id,
      };
      const created = await EmergenciesApi.createEmergency(payloadWithAmbulance);
      setActiveEmergency(created);
      socketService.setEmergencyRoom(created.id);

      // Trigger candidate hospital matching asynchronously in background
      EmergenciesApi.triggerMatching(created.id).catch((err) => {
        console.warn('Hospital matching trigger notice:', err);
      });

      // Trigger post-booking AI observation extraction asynchronously in background
      EmergenciesApi.extractEntities(created.id, created.incident_description || created.location_description || '').catch((err) => {
        console.warn('Post-booking AI extraction notice:', err);
      });

      return created;
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (status: EmergencyStatus, notes?: string) => {
    if (!activeEmergency) return;
    setIsLoading(true);
    try {
      const updated = await EmergenciesApi.updateStatus(activeEmergency.id, status, notes);
      setActiveEmergency(updated);
      if (status === 'HANDOVER_COMPLETED') {
        setActiveEmergency(null);
        setConfirmedHospital(null);
        socketService.setEmergencyRoom(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const completeHandover = async (notes?: string) => {
    if (!activeEmergency) return;
    setIsLoading(true);
    try {
      await EmergenciesApi.confirmHandover(activeEmergency.id, notes);
      setActiveEmergency(null);
      setConfirmedHospital(null);
      socketService.setEmergencyRoom(null);
    } finally {
      setIsLoading(false);
    }
  };

  const clearActiveEmergency = () => {
    setActiveEmergency(null);
    setConfirmedHospital(null);
    socketService.setEmergencyRoom(null);
  };

  return (
    <EmergencyContext.Provider
      value={{
        activeEmergency,
        confirmedHospital,
        isLoading,
        refreshActiveEmergency,
        createEmergency,
        updateStatus,
        completeHandover,
        clearActiveEmergency,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergency = (): EmergencyContextType => {
  const context = useContext(EmergencyContext);
  if (!context) {
    throw new Error('useEmergency must be used within an EmergencyProvider');
  }
  return context;
};
