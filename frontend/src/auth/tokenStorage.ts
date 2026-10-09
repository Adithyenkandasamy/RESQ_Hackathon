/**
 * Token storage: wraps sessionStorage in try/catch so that browsers with
 * strict privacy settings (or SSR) don't throw.
 *
 * The JWT is ALSO held in the module-level `_memoryToken` variable so that
 * patient data carried in the token is never persisted beyond the session
 * (cleared on tab close), and survives same-tab navigation.
 *
 * We never store patient data in localStorage.
 */

const SESSION_KEY = "resq_access_token";

// Module-level in-memory store (authoritative)
let _memoryToken: string | null = null;

export function setToken(token: string): void {
  _memoryToken = token;
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    // sessionStorage unavailable — memory-only is fine
  }
}

export function getToken(): string | null {
  if (_memoryToken) return _memoryToken;
  // Try to restore from sessionStorage on page reload
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      _memoryToken = stored;
      return stored;
    }
  } catch {
    // sessionStorage unavailable
  }
  return null;
}

export function clearSession(): void {
  _memoryToken = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

export function hasStoredSession(): boolean {
  if (_memoryToken) return true;
  try {
    return sessionStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return false;
  }
}
