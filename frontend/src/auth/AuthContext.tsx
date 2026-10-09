import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { login as apiLogin, getMe } from "../api/auth";
import { setToken, clearSession, hasStoredSession } from "./tokenStorage";
import { AUTH_EVENT_401, AUTH_EVENT_403 } from "../api/client";
import type { LoginRequest, UserResponse } from "../api/types";

// ── Types ─────────────────────────────────────────────────────────

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  status: AuthStatus;
  user: UserResponse | null;
  sessionExpiredMessage: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: (message?: string) => void;
}

// ── Context ───────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const [status, setStatus] = useState<AuthStatus>("idle");
  const [user, setUser] = useState<UserResponse | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);

  // Prevent double-bootstrap on StrictMode double-render
  const bootstrapRan = useRef(false);

  // ── Bootstrap: restore session from sessionStorage on mount ──────
  useEffect(() => {
    if (bootstrapRan.current) return;
    bootstrapRan.current = true;

    if (!hasStoredSession()) {
      setStatus("unauthenticated");
      return;
    }

    setStatus("loading");
    getMe()
      .then((me) => {
        setUser(me);
        setStatus("authenticated");
      })
      .catch(() => {
        clearSession();
        setStatus("unauthenticated");
      });
  }, []);

  // ── Listen for 401 events from the API client ────────────────────
  useEffect(() => {
    const handle401 = () => {
      setUser(null);
      setStatus("unauthenticated");
      setSessionExpiredMessage("Your session has expired. Please log in again.");
      navigate("/login", { replace: true });
    };

    const handle403 = () => {
      navigate("/403", { replace: true });
    };

    window.addEventListener(AUTH_EVENT_401, handle401);
    window.addEventListener(AUTH_EVENT_403, handle403);
    return () => {
      window.removeEventListener(AUTH_EVENT_401, handle401);
      window.removeEventListener(AUTH_EVENT_403, handle403);
    };
  }, [navigate]);

  // ── Login ────────────────────────────────────────────────────────
  const login = useCallback(async (credentials: LoginRequest) => {
    const tokenResponse = await apiLogin(credentials);
    setToken(tokenResponse.access_token);

    const me = await getMe();
    setUser(me);
    setStatus("authenticated");
    setSessionExpiredMessage(null);

    // Role-based redirect after login
    if (me.role === "ADMIN") {
      navigate("/admin", { replace: true });
    } else if (me.role === "HOSPITAL_STAFF") {
      navigate("/hospital", { replace: true });
    } else {
      // AMBULANCE_CREW
      navigate("/ambulance-app", { replace: true });
    }
  }, [navigate]);

  // ── Logout ───────────────────────────────────────────────────────
  const logout = useCallback((message?: string) => {
    clearSession();
    setUser(null);
    setStatus("unauthenticated");
    if (message) setSessionExpiredMessage(message);
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ status, user, sessionExpiredMessage, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
