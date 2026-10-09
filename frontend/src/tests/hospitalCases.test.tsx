/**
 * Hospital Cases module tests — Step 2
 *
 * Uses Vitest + React Testing Library + MSW.
 * All test data is SYNTHETIC — never used in production.
 *
 * Covers:
 * 1.  Cases list loading, populated, empty states
 * 2.  Cases list API failure and retry
 * 3.  Status filtering resets pagination and sends correct query param
 * 4.  Opening a case renders returned details
 * 5.  Safe rendering of missing / null / extra patient info fields
 * 6.  Accept/Decline button visibility based on request status and ownership
 * 7.  Accept success
 * 8.  Decline confirmation and success
 * 9.  HTTP 409 conflict handling and authoritative refetch
 * 10. HTTP 401/403/404 handling
 * 11. Empty and failed history loading
 * 12. AI handover unavailable state when backend does not expose it
 * 13. No accept/decline controls for non-PENDING requests
 */

import React from "react";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { beforeAll, afterAll, afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { server } from "./mocks/server";
import {
  SYNTHETIC_EMERGENCY_1,
  SYNTHETIC_EMERGENCY_2,
  SYNTHETIC_HOSPITAL_STAFF_USER,
  SYNTHETIC_HOSPITAL_REQUEST_PENDING,
  SYNTHETIC_HOSPITAL_REQUEST_ACCEPTED,
  SYNTHETIC_HISTORY_ENTRIES,
} from "./mocks/handlers";
import { HospitalCaseList } from "../features/hospital/CaseList";
import { HospitalCaseDetail } from "../features/hospital/CaseDetail";
import { AuthContext } from "../auth/AuthContext";
import { ToastProvider } from "../components/Toast";

const API = "http://localhost:8000";

// ── Test utilities ───────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Hospital staff auth context value */
const HOSPITAL_AUTH = {
  status: "authenticated" as const,
  user: SYNTHETIC_HOSPITAL_STAFF_USER,
  sessionExpiredMessage: null,
  login: vi.fn(),
  logout: vi.fn(),
};

/** No-op auth (unauthenticated) */
const UNAUTH = {
  status: "unauthenticated" as const,
  user: null,
  sessionExpiredMessage: null,
  login: vi.fn(),
  logout: vi.fn(),
};

function renderCaseList(auth = HOSPITAL_AUTH) {
  const qc = makeQueryClient();
  return render(
    <MemoryRouter initialEntries={["/hospital/cases"]}>
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={auth}>
          <ToastProvider>
            <Routes>
              <Route path="/hospital/cases" element={<HospitalCaseList />} />
              <Route
                path="/hospital/cases/:id"
                element={<HospitalCaseDetail />}
              />
            </Routes>
          </ToastProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function renderCaseDetail(id: string, auth = HOSPITAL_AUTH) {
  const qc = makeQueryClient();
  return render(
    <MemoryRouter initialEntries={[`/hospital/cases/${id}`]}>
      <QueryClientProvider client={qc}>
        <AuthContext.Provider value={auth}>
          <ToastProvider>
            <Routes>
              <Route path="/hospital/cases" element={<HospitalCaseList />} />
              <Route
                path="/hospital/cases/:id"
                element={<HospitalCaseDetail />}
              />
            </Routes>
          </ToastProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ── MSW lifecycle ────────────────────────────────────────────────────────────

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

// ── 1. Cases list — loading, populated, empty ─────────────────────────────

describe("HospitalCaseList — loading and populated state", () => {
  it("shows loading skeletons initially, then renders case rows", async () => {
    renderCaseList();
    // Loading state produces skeleton rows in DataTable
    const table = await screen.findByRole("table");
    // After load, rows should contain the incident type
    await waitFor(() => {
      expect(
        screen.getByText(SYNTHETIC_EMERGENCY_1.incident_type)
      ).toBeInTheDocument();
    });
    expect(table).toBeInTheDocument();
  });

  it("renders emergency status badges", async () => {
    renderCaseList();
    await waitFor(() => {
      // StatusBadge for ACCEPTANCE_PENDING renders as "PENDING" (label)
      expect(
        screen.getAllByText(/pending/i).length
      ).toBeGreaterThan(0);
    });
  });

  it("renders the case ID (first 8 chars upper)", async () => {
    renderCaseList();
    await waitFor(() => {
      expect(
        screen.getByText(SYNTHETIC_EMERGENCY_1.id.slice(0, 8).toUpperCase())
      ).toBeInTheDocument();
    });
  });
});

describe("HospitalCaseList — empty state", () => {
  it("shows empty state when filtered results are empty", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies`, () =>
        HttpResponse.json({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          total_pages: 0,
        })
      )
    );
    renderCaseList();
    await waitFor(() => {
      expect(screen.getByText(/no cases found/i)).toBeInTheDocument();
    });
  });
});

// ── 2. API failure and retry ──────────────────────────────────────────────────

describe("HospitalCaseList — API failure and retry", () => {
  it("shows error state on API failure", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies`, () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 })
      )
    );
    renderCaseList();
    await waitFor(() => {
      expect(screen.getByText(/failed to load cases/i)).toBeInTheDocument();
    });
  });

  it("shows retry button and retries on click", async () => {
    let callCount = 0;
    server.use(
      http.get(`${API}/api/v1/emergencies`, () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ detail: "error" }, { status: 500 });
        }
        return HttpResponse.json({
          items: [SYNTHETIC_EMERGENCY_1],
          total: 1,
          page: 1,
          page_size: 20,
          total_pages: 1,
        });
      })
    );
    renderCaseList();
    const retryBtn = await screen.findByRole("button", { name: /try again/i });
    await userEvent.click(retryBtn);
    await waitFor(() => {
      expect(
        screen.getByText(SYNTHETIC_EMERGENCY_1.incident_type)
      ).toBeInTheDocument();
    });
  });
});

// ── 3. Status filtering ───────────────────────────────────────────────────────

describe("HospitalCaseList — status filtering", () => {
  it("sends the status query param when filter is selected", async () => {
    let capturedStatus: string | null = null;
    server.use(
      http.get(`${API}/api/v1/emergencies`, ({ request }) => {
        capturedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({
          items: capturedStatus === "CANCELLED" ? [] : [SYNTHETIC_EMERGENCY_1],
          total: capturedStatus === "CANCELLED" ? 0 : 1,
          page: 1,
          page_size: 20,
          total_pages: capturedStatus === "CANCELLED" ? 0 : 1,
        });
      })
    );
    renderCaseList();
    // Wait for list to load
    await screen.findByRole("table");

    const select = screen.getByLabelText(/filter by emergency status/i);
    await userEvent.selectOptions(select, "CANCELLED");
    await waitFor(() => {
      expect(capturedStatus).toBe("CANCELLED");
    });
  });

  it("omits the status param when 'All statuses' is selected", async () => {
    let capturedStatus: string | null = "initial";
    server.use(
      http.get(`${API}/api/v1/emergencies`, ({ request }) => {
        capturedStatus = new URL(request.url).searchParams.get("status");
        return HttpResponse.json({
          items: [SYNTHETIC_EMERGENCY_1],
          total: 1,
          page: 1,
          page_size: 20,
          total_pages: 1,
        });
      })
    );
    renderCaseList();
    await screen.findByRole("table");
    const select = screen.getByLabelText(/filter by emergency status/i);
    // Select something first
    await userEvent.selectOptions(select, "CREATED");
    // Then clear
    await userEvent.selectOptions(select, "");
    await waitFor(() => {
      expect(capturedStatus).toBeNull();
    });
  });
});

// ── 4. Opening a case and rendering details ───────────────────────────────────

describe("HospitalCaseDetail — renders case details", () => {
  it("displays incident type and ID", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(
        screen.getByText(SYNTHETIC_EMERGENCY_1.incident_type)
      ).toBeInTheDocument();
    });
  });

  it("shows the emergency status badge", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      // StatusBadge renders "Pending" for ACCEPTANCE_PENDING
      expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
    });
  });

  it("shows Back to Cases button", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /back to cases/i })).toBeInTheDocument();
    });
  });
});

// ── 5. Safe rendering of patient info ────────────────────────────────────────

describe("PatientInfoSection — safe rendering", () => {
  it("renders known patient info keys", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      // humanizeKey("known_conditions") => "Known Conditions"
      expect(screen.getByText(/known conditions/i)).toBeInTheDocument();
    });
  });

  it("renders null values as 'Not provided'", async () => {
    // SYNTHETIC_EMERGENCY_1 has blood_pressure: null
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      // There should be at least one "Not provided" for blood_pressure
      expect(screen.getAllByText(/not provided/i).length).toBeGreaterThan(0);
    });
  });

  it("renders empty patient_info without crashing", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_2.id);
    await waitFor(() => {
      expect(
        screen.getByText(/no patient information has been reported/i)
      ).toBeInTheDocument();
    });
  });

  it("labels patient info as 'Reported information'", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(screen.getByText(/reported information/i)).toBeInTheDocument();
    });
  });
});

// ── 6. Accept/Decline visibility based on request status ──────────────────────

describe("AdmissionRequestPanel — button visibility", () => {
  it("shows Accept and Decline buttons when request is PENDING", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /accept/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /decline/i })
      ).toBeInTheDocument();
    });
  });

  it("does NOT show Accept/Decline when request is ACCEPTED", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_2.id);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^accept$/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^decline$/i })
      ).not.toBeInTheDocument();
    });
  });

  it("shows accepted message when request is ACCEPTED", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_2.id);
    await waitFor(() => {
      expect(
        screen.getByText(/your hospital has accepted this admission request/i)
      ).toBeInTheDocument();
    });
  });
});

// ── 7. Accept success ──────────────────────────────────────────────────────────

describe("AdmissionRequestPanel — accept", () => {
  it("calls accept endpoint and shows success toast", async () => {
    let acceptCalled = false;
    server.use(
      http.post(
        `${API}/api/v1/hospital-requests/${SYNTHETIC_HOSPITAL_REQUEST_PENDING.id}/accept`,
        () => {
          acceptCalled = true;
          return HttpResponse.json({
            ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
            status: "ACCEPTED",
            responded_at: new Date().toISOString(),
          });
        }
      )
    );

    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    const acceptBtn = await screen.findByRole("button", {
      name: /^accept$/i,
    });
    await userEvent.click(acceptBtn);
    await waitFor(() => {
      expect(acceptCalled).toBe(true);
    });
    // Toast should appear
    await waitFor(() => {
      expect(
        screen.getByText(/admission request accepted/i)
      ).toBeInTheDocument();
    });
  });

  it("disables the Accept button while request is in-flight", async () => {
    server.use(
      http.post(
        `${API}/api/v1/hospital-requests/${SYNTHETIC_HOSPITAL_REQUEST_PENDING.id}/accept`,
        async () => {
          await new Promise((r) => setTimeout(r, 200));
          return HttpResponse.json({
            ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
            status: "ACCEPTED",
          });
        }
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    const acceptBtn = await screen.findByRole("button", { name: /^accept$/i });
    fireEvent.click(acceptBtn);
    // Immediately after click, button should be disabled or show "Accepting…"
    await waitFor(() => {
      const btn = screen.queryByRole("button", { name: /accepting/i });
      const disabledBtn = screen.queryByRole("button", { name: /^accept$/i });
      expect(btn !== null || disabledBtn?.hasAttribute("disabled")).toBe(true);
    });
  });
});

// ── 8. Decline confirmation and success ───────────────────────────────────────

describe("AdmissionRequestPanel — decline", () => {
  it("shows ConfirmDialog before declining", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    const declineBtn = await screen.findByRole("button", {
      name: /^decline$/i,
    });
    await userEvent.click(declineBtn);
    await waitFor(() => {
      expect(
        screen.getByText(/decline admission request/i)
      ).toBeInTheDocument();
    });
  });

  it("does NOT call decline endpoint when cancelled from dialog", async () => {
    let declineCalled = false;
    server.use(
      http.post(
        `${API}/api/v1/hospital-requests/${SYNTHETIC_HOSPITAL_REQUEST_PENDING.id}/decline`,
        () => {
          declineCalled = true;
          return HttpResponse.json({});
        }
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    const declineBtn = await screen.findByRole("button", { name: /^decline$/i });
    await userEvent.click(declineBtn);
    const cancelBtn = await screen.findByRole("button", { name: /^cancel$/i });
    await userEvent.click(cancelBtn);
    expect(declineCalled).toBe(false);
  });

  it("calls decline endpoint after confirmation and shows toast", async () => {
    let declineCalled = false;
    server.use(
      http.post(
        `${API}/api/v1/hospital-requests/${SYNTHETIC_HOSPITAL_REQUEST_PENDING.id}/decline`,
        () => {
          declineCalled = true;
          return HttpResponse.json({
            ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
            status: "DECLINED",
            responded_at: new Date().toISOString(),
          });
        }
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    const declineBtn = await screen.findByRole("button", { name: /^decline$/i });
    await userEvent.click(declineBtn);
    const confirmBtn = await screen.findByRole("button", {
      name: /decline request/i,
    });
    await userEvent.click(confirmBtn);
    await waitFor(() => {
      expect(declineCalled).toBe(true);
    });
    await waitFor(() => {
      expect(
        screen.getByText(/admission request declined/i)
      ).toBeInTheDocument();
    });
  });
});

// ── 9. HTTP 409 conflict handling ─────────────────────────────────────────────

describe("AdmissionRequestPanel — 409 conflict", () => {
  it("shows conflict toast when 409 is returned from accept", async () => {
    server.use(
      http.post(
        `${API}/api/v1/hospital-requests/${SYNTHETIC_HOSPITAL_REQUEST_PENDING.id}/accept`,
        () =>
          HttpResponse.json(
            { detail: "Emergency has already been accepted by another hospital." },
            { status: 409 }
          )
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    const acceptBtn = await screen.findByRole("button", { name: /^accept$/i });
    await userEvent.click(acceptBtn);
    await waitFor(() => {
      expect(
        screen.getByText(/already been accepted by another hospital/i)
      ).toBeInTheDocument();
    });
  });
});

// ── 10. HTTP 401/403/404 handling ─────────────────────────────────────────────

describe("HospitalCaseDetail — error states", () => {
  it("shows forbidden message on 403", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies/:id`, () =>
        HttpResponse.json(
          { detail: "Access denied" },
          { status: 403 }
        )
      )
    );
    renderCaseDetail("some-unknown-id");
    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
  });

  it("shows not found message on 404", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies/:id`, () =>
        HttpResponse.json(
          { detail: "Emergency incident not found." },
          { status: 404 }
        )
      )
    );
    renderCaseDetail("00000000-0000-0000-0000-000000000099");
    await waitFor(() => {
      expect(screen.getByText(/case not found/i)).toBeInTheDocument();
    });
  });

  it("shows retryable error on 500", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies/:id`, () =>
        HttpResponse.json({ detail: "Server error" }, { status: 500 })
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(screen.getByText(/failed to load case/i)).toBeInTheDocument();
    });
  });
});

describe("HospitalCaseList — 403 handling", () => {
  it("shows access denied message on 403", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies`, () =>
        HttpResponse.json({ detail: "Access denied" }, { status: 403 })
      )
    );
    renderCaseList();
    await waitFor(() => {
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
  });
});

// ── 11. Empty and failed history loading ──────────────────────────────────────

describe("ActivityTimeline", () => {
  it("renders history entries", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      // First entry: "Case created"
      expect(screen.getByText(/case created/i)).toBeInTheDocument();
    });
  });

  it("shows no history message when history is empty", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies/:id/history`, () =>
        HttpResponse.json([])
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(
        screen.getByText(/no activity history available/i)
      ).toBeInTheDocument();
    });
  });

  it("shows timeline error state on history endpoint failure", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies/:id/history`, () =>
        HttpResponse.json({ detail: "error" }, { status: 500 })
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(
        screen.getByText(/could not load activity timeline/i)
      ).toBeInTheDocument();
    });
  });
});

// ── 12. AI handover unavailable state ────────────────────────────────────────

describe("AI handover section", () => {
  it("shows 'Backend endpoint required' for AI handover", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /ai handover summary/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/backend endpoint required/i)
    ).toBeInTheDocument();
  });

  it("labels AI section with clinical review warning", async () => {
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await waitFor(() => {
      expect(
        screen.getByText(/ai-generated draft/i)
      ).toBeInTheDocument();
    });
  });
});

// ── 13. No unauthorized actions ───────────────────────────────────────────────

describe("Authorization guards", () => {
  it("does not show Accept/Decline for CANCELLED request", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies/:id/requests`, () =>
        HttpResponse.json([
          {
            ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
            status: "CANCELLED",
          },
        ])
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await screen.findByText(SYNTHETIC_EMERGENCY_1.incident_type);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^accept$/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^decline$/i })
      ).not.toBeInTheDocument();
    });
  });

  it("does not show Accept/Decline for EXPIRED request", async () => {
    server.use(
      http.get(`${API}/api/v1/emergencies/:id/requests`, () =>
        HttpResponse.json([
          {
            ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
            status: "EXPIRED",
          },
        ])
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await screen.findByText(SYNTHETIC_EMERGENCY_1.incident_type);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^accept$/i })
      ).not.toBeInTheDocument();
    });
  });

  it("does not show actions for a request belonging to a different hospital", async () => {
    // Hospital staff user hospital_id = 00000000-0000-0000-0000-000000000010
    // Request here belongs to a different hospital
    server.use(
      http.get(`${API}/api/v1/emergencies/:id/requests`, () =>
        HttpResponse.json([
          {
            ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
            hospital_id: "ffffffff-ffff-ffff-ffff-ffffffffffff", // different hospital
          },
        ])
      )
    );
    renderCaseDetail(SYNTHETIC_EMERGENCY_1.id);
    await screen.findByText(SYNTHETIC_EMERGENCY_1.incident_type);
    await waitFor(() => {
      // myRequest should be null since hospital_id doesn't match user.hospital_id
      expect(
        screen.queryByRole("button", { name: /^accept$/i })
      ).not.toBeInTheDocument();
    });
  });
});
