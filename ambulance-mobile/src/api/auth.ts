import { apiClient } from './client';
import { User, TokenResponse, LoginPayload, CrewRegisterPayload } from '../types/auth';

export const AuthApi = {
  async login(payload: LoginPayload): Promise<TokenResponse> {
    return apiClient<TokenResponse>('/auth/login', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
  },

  async registerCrew(payload: CrewRegisterPayload): Promise<User> {
    return apiClient<User>('/auth/register-crew', {
      method: 'POST',
      body: payload,
      skipAuth: true,
    });
  },

  async getMe(): Promise<User> {
    return apiClient<User>('/auth/me', {
      method: 'GET',
    });
  },
};
