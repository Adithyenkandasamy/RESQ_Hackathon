import { Platform } from 'react-native';
import { SecureStorageService } from '../services/secureStorage';

// Safely obtain hostUri from Expo Constants in runtime without breaking Jest CommonJS tests
const getHostUri = (): string | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default || require('expo-constants');
    return Constants?.expoConfig?.hostUri || null;
  } catch {
    return null;
  }
};

// Default resolution based on platform and Expo runtime
const getDefaultBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // In Expo Go on a physical device, resolve automatically to the host computer's LAN IP
  const hostUri = getHostUri();
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000`;
    }
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://localhost:8000';
};

export const API_BASE_URL = getDefaultBaseUrl();
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
    public requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorized = (cb: () => void) => {
  onUnauthorizedCallback = cb;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  isMultipart?: boolean;
  timeoutMs?: number;
  skipAuth?: boolean;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    isMultipart = false,
    timeoutMs = 30000,
    skipAuth = false,
  } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${API_V1_URL}${endpoint}`;
  const requestHeaders: Record<string, string> = { ...headers };

  if (!skipAuth) {
    const token = await SecureStorageService.getToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  let requestBody: BodyInit | undefined = undefined;

  if (isMultipart) {
    requestBody = body as FormData;
  } else if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }

  // Use Promise.race instead of aggressive AbortController signal
  // so React Native doesn't abruptly cancel active HTTP connections during screen transitions
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ApiError('Request timed out. Please check your network connection.', 408));
    }, timeoutMs);
  });

  const fetchPromise = (async (): Promise<T> => {
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
      });

      if (timer) clearTimeout(timer);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 401 && !skipAuth) {
          await SecureStorageService.clearToken();
          if (onUnauthorizedCallback) {
            onUnauthorizedCallback();
          }
        }

        let errorMessage = `Request failed with status ${response.status}`;
        let reqId: string | undefined = undefined;

        if (typeof data === 'object' && data !== null) {
          const payload = data as Record<string, any>;
          if (payload.detail) {
            if (typeof payload.detail === 'string') {
              errorMessage = payload.detail;
            } else if (Array.isArray(payload.detail)) {
              errorMessage = payload.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
            }
          } else if (payload.error && payload.error.message) {
            errorMessage = payload.error.message;
            reqId = payload.error.request_id;
          } else if (payload.message) {
            errorMessage = payload.message;
          }
        }

        throw new ApiError(errorMessage, response.status, data, reqId);
      }

      return data as T;
    } catch (error: any) {
      if (timer) clearTimeout(timer);
      if (error instanceof ApiError) {
        throw error;
      }
      const rawMsg = error?.message || '';
      if (rawMsg.toLowerCase().includes('abort') || rawMsg.toLowerCase().includes('cancel')) {
        throw new ApiError('Request was cancelled.', 499);
      }
      throw new ApiError(rawMsg || 'Network error connecting to backend service.', 0);
    }
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}
