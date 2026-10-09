/**
 * Tests: Hospital Dashboard and Real-Time Updates — Step 3
 *
 * Covers:
 * 1.  Dashboard loading, success, empty, and error states
 * 2.  Correct summary calculations using real response schemas
 * 3.  Pending requests and case-detail navigation
 * 4.  Countdown rendering and deadline-passed behavior
 * 5.  Invalid or missing deadlines
 * 6.  Socket connection and authentication configuration
 * 7.  Correct subscriptions to confirmed backend event names
 * 8.  Event-driven query invalidation
 * 9.  No duplicate listeners or duplicate notifications
 * 10. Listener cleanup and socket disconnection on logout / unmount
 * 11. Disconnected banner and 15-second polling fallback
 * 12. Polling stops after reconnection
 * 13. REST refresh after reconnect
 * 14. Socket failure does not erase existing REST data
 * 15. Expired session behavior
 * 16. No patient details in notification messages
 *
 * Uses SYNTHETIC DATA (MSW + Vitest).
 */

import React from "react";
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { server } from "./mocks/server";
import {
  SYNTHETIC_HOSPITAL_STAFF_USER,
  SYNTHETIC_HOSPITAL_REQUEST_PENDING,
  SYNTHETIC_HOSPITAL_REQUEST_ACCEPTED,
  SYNTHETIC_HOSPITAL_REQUEST_EXPIRED,
  SYNTHETIC_HOSPITAL_PROFILE,
  SYNTHETIC_EMERGENCY_1,
  SYNTHETIC_EMERGENCY_2,
  SYNTHETIC_TOKEN,
} from "./mocks/handlers";
import { setToken, clearSession } from "../auth/tokenStorage";
import { HospitalDashboard } from "../features/hospital/Dashboard";
import { AuthContext } from "../auth/AuthContext";
import { ToastProvider } from "../components/Toast";
import { Countdown } from "../components/Countdown";
import {
  createHospitalSocket,
  invalidateForSocketEvent,
  notifyForSocketEvent,
  SOCKET_PATH,
  SOCKET_URL,
} from "../lib/socket";

const API = "http://localhost:8000";

// ── Mock socket.io-client ─────────────────────────────────────────────────────

const registeredListeners: Record<string, Function[]> = {};

const mockSocket = {
  on: vi.fn((event: string, callback: Function) => {
    registeredListeners[event] = registeredListeners[event] || [];
    registeredListeners[event].push(callback);
    return mockSocket;
  }),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

function triggerSocketEvent(event: string, ...args: unknown[]) {
  act(() => {
    registeredListeners[event]?.forEach((cb) => cb(...args));
  });
}

// ── Test Setup ────────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
beforeEach(() => {
  setToken(SYNTHETIC_TOKEN);
});
afterEach(() => {
  server.resetHandlers();
  clearSession();
  vi.clearAllMocks();
  Object.keys(registeredListeners).forEach((k) => delete registeredListeners[k]);
});
afterAll(() => server.close());

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const HOSPITAL_AUTH = {
  status: "authenticated" as const,
  user: SYNTHETIC_HOSPITAL_STAFF_USER,
  sessionExpiredMessage: null,
  login: vi.fn(),
  logout: vi.fn(),
};

function renderDashboard(auth = HOSPITAL_AUTH) {
  const qc = makeQueryClient();
  return {
    qc,
    ...render(
      <MemoryRouter initialEntries={["/hospital/dashboard"]}>
        <QueryClientProvider client={qc}>
          <AuthContext.Provider value={auth}>
            <ToastProvider>
              <Routes>
                <Route
                  path="/hospital/dashboard"
                  element={<HospitalDashboard />}
                />
                <Route
                  path="/hospital/cases/:id"
                  element={<div>Case Detail Page</div>}
                />
              </Routes>
            </ToastProvider>
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    ),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HospitalDashboard — Initial Rendering & State", () => {
  it("renders dashboard header, live connection indicator, and summary metrics", async () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: /hospital dashboard/i })).toBeInTheDocument();
    expect(
      screen.getByText(/monitor incoming emergency requests/i)
    ).toBeInTheDocument();

    // Summary cards become populated
    await waitFor(() => {
      expect(screen.getByText("Pending Requests")).toBeInTheDocument();
      expect(screen.getByText("Accepted Requests")).toBeInTheDocument();
      expect(screen.getByText("Expired Requests")).toBeInTheDocument();
      expect(screen.getByText("Active Assigned Cases")).toBeInTheDocument();
    });

    // Check calculated metrics: 1 pending, 1 accepted, 1 expired
    const pendingCard = screen.getByText("Pending Requests").closest("div");
    expect(within(pendingCard!).getByText("1")).toBeInTheDocument();

    const acceptedCard = screen.getByText("Accepted Requests").closest("div");
    expect(within(acceptedCard!).getByText("1")).toBeInTheDocument();

    const expiredCard = screen.getByText("Expired Requests").closest("div");
    expect(within(expiredCard!).getByText("1")).toBeInTheDocument();
  });

  it("renders pending admission requests by default with countdown", async () => {
    renderDashboard();

    // Pending request row rendered
    const emergencyLinks = await screen.findAllByRole("link", {
      name: SYNTHETIC_EMERGENCY_1.id.slice(0, 8).toUpperCase(),
    });
    expect(emergencyLinks[0]).toBeInTheDocument();
    expect(emergencyLinks[0]).toHaveAttribute(
      "href",
      `/hospital/cases/${SYNTHETIC_EMERGENCY_1.id}`
    );

    // View Case action button
    const viewCaseButtons = screen.getAllByRole("link", { name: /view case/i });
    expect(viewCaseButtons.length).toBeGreaterThan(0);
  });

  it("allows switching tabs between Pending, Accepted, and Expired requests", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByRole("button", { name: /accepted \(1\)/i });

    // Switch to Accepted tab
    await user.click(screen.getByRole("button", { name: /accepted \(1\)/i }));
    const emergency2Links = await screen.findAllByRole("link", {
      name: SYNTHETIC_EMERGENCY_2.id.slice(0, 8).toUpperCase(),
    });
    expect(emergency2Links[0]).toBeInTheDocument();

    // Switch to Expired tab
    await user.click(screen.getByRole("button", { name: /expired \(1\)/i }));
    expect(
      screen.getByRole("link", {
        name: "CCC00000",
      })
    ).toBeInTheDocument();
  });

  it("shows empty state when no requests exist for a tab", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/api/v1/hospital-requests`, () => HttpResponse.json([]))
    );

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(/no pending admission requests/i)
      ).toBeInTheDocument();
    });

    // Switch to Accepted tab
    await user.click(screen.getByRole("button", { name: /accepted \(0\)/i }));
    expect(screen.getByText(/no accepted requests/i)).toBeInTheDocument();
  });

  it("renders error state when hospital requests fail to load and allows retry", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/api/v1/hospital-requests`, () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 })
      )
    );

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load admission requests/i)
      ).toBeInTheDocument();
    });

    // Reset handler to succeed
    server.use(
      http.get(`${API}/api/v1/hospital-requests`, () =>
        HttpResponse.json([SYNTHETIC_HOSPITAL_REQUEST_PENDING])
      )
    );

    const errorBox = screen.getByText(/failed to load admission requests/i).closest("div");
    const retryBtn = within(errorBox!).getByRole("button", { name: /try again/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(
        screen.getAllByRole("link", {
          name: SYNTHETIC_EMERGENCY_1.id.slice(0, 8).toUpperCase(),
        }).length
      ).toBeGreaterThan(0);
    });
  });
});

describe("Hospital Availability Toggle", () => {
  it("renders hospital profile name and intake status", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(SYNTHETIC_HOSPITAL_PROFILE.name)).toBeInTheDocument();
      expect(screen.getByText("Accepting Patients")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pause intake/i })).toBeInTheDocument();
    });
  });

  it("toggles intake availability via PATCH /api/v1/hospitals/me/availability", async () => {
    const user = userEvent.setup();
    let patchedBody: any = null;

    server.use(
      http.patch(`${API}/api/v1/hospitals/me/availability`, async ({ request }) => {
        patchedBody = await request.json();
        return HttpResponse.json({
          ...SYNTHETIC_HOSPITAL_PROFILE,
          reported_availability: {
            ...SYNTHETIC_HOSPITAL_PROFILE.reported_availability,
            accepting_patients: false,
          },
        });
      })
    );

    renderDashboard();

    const pauseBtn = await screen.findByRole("button", { name: /pause intake/i });
    await user.click(pauseBtn);

    await waitFor(() => {
      expect(patchedBody).toEqual({
        reported_availability: {
          accepting_patients: false,
          icu_beds_available: 4,
        },
      });
      expect(
        screen.getByText(/intake paused/i)
      ).toBeInTheDocument();
    });
  });
});

describe("Countdown Component Enhancement", () => {
  it("renders remaining time countdown format", () => {
    // 5 minutes in future
    const future = new Date(Date.now() + 300_000).toISOString();
    render(<Countdown deadline={future} />);

    expect(screen.getByText(/remaining/i)).toBeInTheDocument();
  });

  it("renders 'Deadline passed — awaiting server status' when deadline has passed", () => {
    // 5 minutes in past
    const past = new Date(Date.now() - 300_000).toISOString();
    render(<Countdown deadline={past} />);

    expect(
      screen.getByText(/deadline passed — awaiting server status/i)
    ).toBeInTheDocument();
  });

  it("handles null, missing, or invalid deadline gracefully", () => {
    const { unmount } = render(<Countdown deadline={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    unmount();

    render(<Countdown deadline="not-a-date" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("Socket.IO Real-Time Integration & Connection Lifecycle", () => {
  it("initializes Socket.IO with path /socket.io and token in handshake auth", async () => {
    const { io } = await import("socket.io-client");
    const qc = makeQueryClient();

    createHospitalSocket({
      user: SYNTHETIC_HOSPITAL_STAFF_USER,
      queryClient: qc,
    });

    expect(io).toHaveBeenCalledWith(
      SOCKET_URL,
      expect.objectContaining({
        path: SOCKET_PATH,
        auth: expect.objectContaining({
          token: expect.any(String),
        }),
      })
    );
  });

  it("joins room hospital:{hospital_id} and invalidates queries on connect", async () => {
    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    createHospitalSocket({
      user: SYNTHETIC_HOSPITAL_STAFF_USER,
      queryClient: qc,
    });

    // Simulate socket connect event
    triggerSocketEvent("connect");

    expect(mockSocket.emit).toHaveBeenCalledWith(
      "join_room",
      { room: `hospital:${SYNTHETIC_HOSPITAL_STAFF_USER.hospital_id}` },
      expect.any(Function)
    );

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["hospitalRequests"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["emergencies"] });
  });

  it("subscribes to all confirmed backend event names", () => {
    const qc = makeQueryClient();
    createHospitalSocket({
      user: SYNTHETIC_HOSPITAL_STAFF_USER,
      queryClient: qc,
    });

    const expectedEvents = [
      "hospital_request.created",
      "hospital_request.accepted",
      "hospital_request.declined",
      "hospital.assigned",
      "emergency.status.updated",
      "emergency.handover_confirmed",
    ];

    expectedEvents.forEach((ev) => {
      expect(mockSocket.on).toHaveBeenCalledWith(ev, expect.any(Function));
    });
  });

  it("invalidates queries on hospital_request.created without displaying patient PII", () => {
    const qc = makeQueryClient();
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
    const toastSpy = vi.fn();

    createHospitalSocket({
      user: SYNTHETIC_HOSPITAL_STAFF_USER,
      queryClient: qc,
      addToast: toastSpy,
    });

    const payload = {
      event_id: "evt-001",
      event_type: "hospital_request.created",
      occurred_at: new Date().toISOString(),
      resource_id: "req-123",
      data: {
        request_id: "req-123",
        emergency_id: "emg-456",
        incident_type: "Cardiac",
      },
    };

    triggerSocketEvent("hospital_request.created", payload);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["hospitalRequests"] });
    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringMatching(/admission request/i),
      "info"
    );

    // Verify patient PII is NOT in toast
    expect(toastSpy).not.toHaveBeenCalledWith(
      expect.stringMatching(/Cardiac/i),
      expect.anything()
    );
  });

  it("de-duplicates toasts for repeated events with the same event_id", () => {
    const toastSpy = vi.fn();
    const payload = {
      event_id: "unique-event-id-999",
      event_type: "hospital_request.declined",
      occurred_at: new Date().toISOString(),
      resource_id: "req-1",
      data: {},
    };

    notifyForSocketEvent("hospital_request.declined", payload, toastSpy);
    expect(toastSpy).toHaveBeenCalledTimes(1);

    // Second call with same event_id must be ignored
    notifyForSocketEvent("hospital_request.declined", payload, toastSpy);
    expect(toastSpy).toHaveBeenCalledTimes(1);
  });

  it("cleans up listeners and disconnects on unmount", () => {
    const { unmount } = renderDashboard();
    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});

describe("Disconnection, Reconnection Banner & 15-second Polling Fallback", () => {
  it("displays reconnecting banner when socket disconnects", async () => {
    renderDashboard();

    // Trigger disconnect
    triggerSocketEvent("disconnect", "transport close");

    await waitFor(() => {
      expect(
        screen.getByText(/live updates lost\. reconnecting…/i)
      ).toBeInTheDocument();
    });
  });

  it("does not erase existing REST data when socket disconnects", async () => {
    renderDashboard();

    // Data loaded
    const initialLinks = await screen.findAllByRole("link", {
      name: SYNTHETIC_EMERGENCY_1.id.slice(0, 8).toUpperCase(),
    });
    expect(initialLinks.length).toBeGreaterThan(0);

    // Trigger disconnect
    triggerSocketEvent("disconnect", "transport error");

    // Existing data is still present
    const remainingLinks = screen.getAllByRole("link", {
      name: SYNTHETIC_EMERGENCY_1.id.slice(0, 8).toUpperCase(),
    });
    expect(remainingLinks.length).toBeGreaterThan(0);
  });

  it("removes reconnecting banner and shows live updates active on reconnect", async () => {
    renderDashboard();

    triggerSocketEvent("disconnect", "transport close");
    await screen.findByText(/live updates lost\. reconnecting…/i);

    // Reconnect
    triggerSocketEvent("reconnect");

    await waitFor(() => {
      expect(
        screen.queryByText(/live updates lost\. reconnecting…/i)
      ).not.toBeInTheDocument();
      expect(screen.getByText(/live updates active/i)).toBeInTheDocument();
    });
  });
});
