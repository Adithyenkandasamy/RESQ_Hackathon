import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, LoginPayload, CrewRegisterPayload } from '../types/auth';
import { Ambulance, AmbulanceStatus } from '../types/ambulance';
import { AuthApi } from '../api/auth';
import { AmbulanceApi } from '../api/ambulance';
import { SecureStorageService } from '../services/secureStorage';
import { setOnUnauthorized } from '../api/client';
import { socketService } from '../services/socket';

interface AuthContextType {
  user: User | null;
  ambulance: Ambulance | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  registerCrew: (payload: CrewRegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateAvailability: (status: AmbulanceStatus) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ambulance, setAmbulance] = useState<Ambulance | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(async () => {
    await SecureStorageService.clearToken();
    socketService.disconnect();
    setToken(null);
    setUser(null);
    setAmbulance(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const storedToken = await SecureStorageService.getToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      setToken(storedToken);

      const me = await AuthApi.getMe();
      setUser(me);

      if (me.role === 'AMBULANCE_CREW' && me.ambulance_id) {
        const amb = await AmbulanceApi.getCurrentAmbulance();
        setAmbulance(amb);
        socketService.connect(amb.id);
      }
    } catch (e) {
      console.warn('Failed to restore auth session:', e);
      await logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
    refreshProfile();
  }, [logout, refreshProfile]);

  const login = async (credentials: LoginPayload) => {
    setIsLoading(true);
    try {
      const authResponse = await AuthApi.login(credentials);
      await SecureStorageService.saveToken(authResponse.access_token);
      setToken(authResponse.access_token);

      const me = await AuthApi.getMe();
      if (me.role !== 'AMBULANCE_CREW') {
        await SecureStorageService.clearToken();
        throw new Error('Unauthorized role. This mobile app is exclusively for ambulance crew.');
      }
      setUser(me);

      if (me.ambulance_id) {
        const amb = await AmbulanceApi.getCurrentAmbulance();
        setAmbulance(amb);
        socketService.connect(amb.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const registerCrew = async (payload: CrewRegisterPayload) => {
    setIsLoading(true);
    try {
      await AuthApi.registerCrew(payload);
      // Auto login after registration
      await login({ email: payload.email, password: payload.password });
    } finally {
      setIsLoading(false);
    }
  };

  const updateAvailability = async (status: AmbulanceStatus) => {
    if (!ambulance) return;
    const updated = await AmbulanceApi.updateAvailability(status);
    setAmbulance(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        ambulance,
        token,
        isLoading,
        login,
        registerCrew,
        logout,
        updateAvailability,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
