/**
 * Socket.IO client module for RESQ real-time updates.
 *
 * Connects to the ASGI backend at path `/socket.io`.
 * Authenticates via JWT in the handshake payload: `auth: { token }`.
 * Joins operational room `hospital:{hospital_id}` for authorized hospital staff.
 *
 * Centralizes:
 * - Connection lifecycle & reconnection tracking
 * - Real-time query invalidation
 * - De-duplicated operational toasts (without patient PII)
 * - Safe payload validation
 */

import { io, Socket } from "socket.io-client";
import type { QueryClient } from "@tanstack/react-query";
import { getToken } from "../auth/tokenStorage";
import type { UserResponse } from "../api/types";

export const SOCKET_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const SOCKET_PATH = "/socket.io";

export type SocketConnectionState =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected"
  | "unavailable";

export interface SocketEnvelope<T = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  occurred_at: string;
  resource_id: string;
  data: T;
}

// ── In-memory de-duplication store for event toasts ───────────────────────────
const processedEventIds = new Set<string>();
const MAX_PROCESSED_EVENTS = 200;

function isDuplicateEvent(eventId: string): boolean {
  if (!eventId) return false;
  if (processedEventIds.has(eventId)) return true;
  processedEventIds.add(eventId);
  if (processedEventIds.size > MAX_PROCESSED_EVENTS) {
    const first = processedEventIds.values().next().value;
    if (first) processedEventIds.delete(first);
  }
  return false;
}

// ── Query invalidation per confirmed event type ───────────────────────────────

export function invalidateForSocketEvent(
  eventType: string,
  payload: SocketEnvelope,
  queryClient: QueryClient
): void {
  const emergencyId = (payload.data as { emergency_id?: string })?.emergency_id;
  const requestId = (payload.data as { request_id?: string })?.request_id;

  switch (eventType) {
    case "hospital_request.created":
      queryClient.invalidateQueries({ queryKey: ["hospitalRequests"] });
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
      queryClient.invalidateQueries({ queryKey: ["emergencies", "hospital"] });
      break;

    case "hospital_request.accepted":
      queryClient.invalidateQueries({ queryKey: ["hospitalRequests"] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ["hospitalRequest", requestId] });
      }
      if (emergencyId) {
        queryClient.invalidateQueries({ queryKey: ["emergency", emergencyId] });
        queryClient.invalidateQueries({ queryKey: ["emergencyRequests", emergencyId] });
      }
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
      queryClient.invalidateQueries({ queryKey: ["emergencies", "hospital"] });
      break;

    case "hospital_request.declined":
      queryClient.invalidateQueries({ queryKey: ["hospitalRequests"] });
      if (requestId) {
        queryClient.invalidateQueries({ queryKey: ["hospitalRequest", requestId] });
      }
      if (emergencyId) {
        queryClient.invalidateQueries({ queryKey: ["emergency", emergencyId] });
        queryClient.invalidateQueries({ queryKey: ["emergencyRequests", emergencyId] });
      }
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
      break;

    case "hospital.assigned":
      if (emergencyId) {
        queryClient.invalidateQueries({ queryKey: ["emergency", emergencyId] });
        queryClient.invalidateQueries({ queryKey: ["emergencyRequests", emergencyId] });
        queryClient.invalidateQueries({ queryKey: ["emergencyDestination", emergencyId] });
      }
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
      queryClient.invalidateQueries({ queryKey: ["emergencies", "hospital"] });
      queryClient.invalidateQueries({ queryKey: ["hospitalRequests"] });
      break;

    case "emergency.status.updated":
      if (emergencyId) {
        queryClient.invalidateQueries({ queryKey: ["emergency", emergencyId] });
        queryClient.invalidateQueries({ queryKey: ["emergencyHistory", emergencyId] });
      }
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
      queryClient.invalidateQueries({ queryKey: ["emergencies", "hospital"] });
      break;

    case "emergency.handover_confirmed":
      if (emergencyId) {
        queryClient.invalidateQueries({ queryKey: ["emergency", emergencyId] });
        queryClient.invalidateQueries({ queryKey: ["emergencyHistory", emergencyId] });
      }
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
      break;

    default:
      // Unknown event type – conservative fallback: refresh list queries
      queryClient.invalidateQueries({ queryKey: ["hospitalRequests"] });
      queryClient.invalidateQueries({ queryKey: ["emergencies"] });
      break;
  }

  // Also invalidate hospital dashboard queries for instant real-time UI updates
  queryClient.invalidateQueries({ queryKey: ["hospital-requests"] });
  queryClient.invalidateQueries({ queryKey: ["hospital-active-emergencies"] });
}

// ── Toast notification helper (clinical privacy: NO patient PII) ──────────────

export function notifyForSocketEvent(
  eventType: string,
  payload: SocketEnvelope,
  addToast: (message: string, type: "info" | "success" | "warning" | "error") => void
): void {
  if (isDuplicateEvent(payload.event_id)) {
    return;
  }

  const data = payload.data as Record<string, unknown>;

  switch (eventType) {
    case "hospital_request.created":
      addToast(
        `Inbound admission request received for emergency incident.`,
        "info"
      );
      break;

    case "hospital_request.accepted":
      addToast(
        "Admission request marked accepted for this hospital.",
        "success"
      );
      break;

    case "hospital_request.declined":
      addToast("Admission request recorded as declined.", "info");
      break;

    case "hospital.assigned":
      addToast(
        `Hospital destination confirmed: ${String(data.hospital_name || "Assigned")}.`,
        "success"
      );
      break;

    case "emergency.status.updated":
      if (data.new_status) {
        addToast(
          `Emergency status updated to ${String(data.new_status).replace(/_/g, " ")}.`,
          "info"
        );
      }
      break;

    case "emergency.handover_confirmed":
      addToast(
        "Clinical handover confirmed for emergency incident.",
        "success"
      );
      break;

    default:
      break;
  }
}

// ── Socket instance creator ───────────────────────────────────────────────────

export interface CreateSocketOptions {
  user: UserResponse;
  queryClient: QueryClient;
  addToast?: (message: string, type: "info" | "success" | "warning" | "error") => void;
  onStateChange?: (state: SocketConnectionState) => void;
}

export function createHospitalSocket(options: CreateSocketOptions): Socket | null {
  const { user, queryClient, addToast, onStateChange } = options;

  // Allow HOSPITAL_STAFF and ADMIN users
  if (!user || (user.role !== "HOSPITAL_STAFF" && user.role !== "ADMIN")) {
    onStateChange?.("unavailable");
    return null;
  }

  const token = getToken();
  if (!token) {
    onStateChange?.("disconnected");
    return null;
  }

  onStateChange?.("connecting");

  const socket: Socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    autoConnect: true,
  });

  const roomName = user.hospital_id ? `hospital:${user.hospital_id}` : "admin";

  socket.on("connect", () => {
    onStateChange?.("connected");

    // Join authorized hospital room
    socket.emit("join_room", { room: roomName }, (res?: { status: string }) => {
      if (res?.status === "error") {
        console.warn("Failed to join room:", roomName);
      }
    });

    // Authoritative REST refresh after connecting or reconnecting
    queryClient.invalidateQueries({ queryKey: ["hospitalRequests"] });
    queryClient.invalidateQueries({ queryKey: ["emergencies"] });
    queryClient.invalidateQueries({ queryKey: ["myHospital"] });
  });

  socket.on("disconnect", (reason) => {
    if (reason === "io client disconnect") {
      onStateChange?.("disconnected");
    } else {
      onStateChange?.("reconnecting");
    }
  });

  socket.on("connect_error", () => {
    onStateChange?.("reconnecting");
  });

  socket.on("reconnect_attempt", () => {
    onStateChange?.("reconnecting");
  });

  socket.on("reconnect", () => {
    onStateChange?.("connected");
    socket.emit("join_room", { room: roomName });
    queryClient.invalidateQueries({ queryKey: ["hospitalRequests"] });
    queryClient.invalidateQueries({ queryKey: ["emergencies"] });
    queryClient.invalidateQueries({ queryKey: ["myHospital"] });
  });

  // ── Event subscriptions ───────────────────────────────────────────────────

  const eventNames = [
    "hospital_request.created",
    "hospital_request.accepted",
    "hospital_request.declined",
    "hospital.assigned",
    "emergency.status.updated",
    "emergency.handover_confirmed",
  ] as const;

  eventNames.forEach((eventName) => {
    socket.on(eventName, (envelope: unknown) => {
      if (
        !envelope ||
        typeof envelope !== "object" ||
        !("event_type" in envelope)
      ) {
        return;
      }
      const typed = envelope as SocketEnvelope;
      invalidateForSocketEvent(eventName, typed, queryClient);
      if (addToast) {
        notifyForSocketEvent(eventName, typed, addToast);
      }
    });
  });

  return socket;
}
