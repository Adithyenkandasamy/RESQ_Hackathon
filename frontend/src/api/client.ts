/**
 * Typed HTTP client wrapping axios.
 * - Attaches Authorization: Bearer <token> on every request.
 * - On 401 → clears session, dispatches a custom event so AuthContext can redirect.
 * - On 403 → dispatches a custom event so the router can render the permission-denied page.
 * - Never logs or persists patient data from response bodies.
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosError,
} from "axios";
import { getToken, clearSession } from "../auth/tokenStorage";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Custom DOM events emitted by the client so AuthContext can react without circular imports.
export const AUTH_EVENT_401 = "resq:auth:401";
export const AUTH_EVENT_403 = "resq:auth:403";

function createAxiosInstance(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE,
    headers: { "Content-Type": "application/json" },
    timeout: 15_000,
  });

  // Request interceptor – inject the bearer token
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor – handle auth errors
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        const url = error.config?.url ?? "";
        if (!url.includes("/auth/login")) {
          clearSession();
          window.dispatchEvent(new CustomEvent(AUTH_EVENT_401));
        }
      }
      if (error.response?.status === 403) {
        window.dispatchEvent(new CustomEvent(AUTH_EVENT_403));
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export const apiClient: AxiosInstance = createAxiosInstance();

// ── Typed convenience wrappers ────────────────────────────────────

export async function apiGet<T>(
  path: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await apiClient.get<T>(path, config);
  return res.data;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await apiClient.post<T>(path, body, config);
  return res.data;
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await apiClient.patch<T>(path, body, config);
  return res.data;
}

export async function apiDelete<T>(
  path: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await apiClient.delete<T>(path, config);
  return res.data;
}

/**
 * Maps a 422 HTTPValidationError into field-keyed error messages.
 * Returns a record of { fieldName: "message" } for use with react-hook-form.
 */
export function mapValidationErrors(
  error: AxiosError
): Record<string, string> {
  const result: Record<string, string> = {};
  const data = error.response?.data as
    | { detail: { loc: (string | number)[]; msg: string }[] }
    | undefined;

  if (!data?.detail || !Array.isArray(data.detail)) return result;

  for (const ve of data.detail) {
    const field = ve.loc.filter((s) => s !== "body").join(".");
    result[field] = ve.msg;
  }
  return result;
}

/**
 * Returns a human-readable error message from any API error.
 */
export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail.map((v: { msg: string }) => v.msg).join("; ");
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}
