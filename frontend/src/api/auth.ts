import { apiGet, apiPost } from "./client";
import type { LoginRequest, TokenResponse, UserResponse } from "./types";

const BASE = "/api/v1/auth";

export function login(payload: LoginRequest): Promise<TokenResponse> {
  return apiPost<TokenResponse>(`${BASE}/login`, payload);
}

export function getMe(): Promise<UserResponse> {
  return apiGet<UserResponse>(`${BASE}/me`);
}
