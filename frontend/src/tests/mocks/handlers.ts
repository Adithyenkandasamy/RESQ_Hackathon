/**
 * MSW handlers for test mocking.
 * All data here is SYNTHETIC DATA — never used in production flows.
 */

import { http, HttpResponse } from "msw";

const API = "http://localhost:8000";

// ── Synthetic data (clearly labelled) ─────────────────────────────
// SYNTHETIC DATA: not real hospital or patient records

export const SYNTHETIC_ADMIN_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@resq.test",
  role: "ADMIN" as const,
  is_active: true,
  hospital_id: null,
  ambulance_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const SYNTHETIC_HOSPITAL_STAFF_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "staff@city-hospital.test",
  role: "HOSPITAL_STAFF" as const,
  is_active: true,
  hospital_id: "00000000-0000-0000-0000-000000000010",
  ambulance_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const SYNTHETIC_AMBULANCE_CREW_USER = {
  id: "00000000-0000-0000-0000-000000000003",
  email: "crew@resq.test",
  role: "AMBULANCE_CREW" as const,
  is_active: true,
  hospital_id: null,
  ambulance_id: "00000000-0000-0000-0000-000000000020",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const SYNTHETIC_TOKEN = "eyJ0eXAiOiJKV1QifQ.SYNTHETIC.test";

// ── Handlers ──────────────────────────────────────────────────────

export const handlers = [
  // Login — success for admin
  http.post(`${API}/api/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === "admin@resq.test" && body.password === "password") {
      return HttpResponse.json({
        access_token: SYNTHETIC_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      });
    }
    if (body.email === "staff@city-hospital.test" && body.password === "password") {
      return HttpResponse.json({
        access_token: SYNTHETIC_TOKEN + "_hospital",
        token_type: "bearer",
        expires_in: 3600,
      });
    }
    if (body.email === "crew@resq.test" && body.password === "password") {
      return HttpResponse.json({
        access_token: SYNTHETIC_TOKEN + "_crew",
        token_type: "bearer",
        expires_in: 3600,
      });
    }

    return HttpResponse.json(
      { detail: "Invalid email or password." },
      { status: 401 }
    );
  }),

  // GET /me — returns user based on token
  http.get(`${API}/api/v1/auth/me`, ({ request }) => {
    const auth = request.headers.get("authorization") ?? "";

    if (auth.includes("_hospital")) {
      return HttpResponse.json(SYNTHETIC_HOSPITAL_STAFF_USER);
    }
    if (auth.includes("_crew")) {
      return HttpResponse.json(SYNTHETIC_AMBULANCE_CREW_USER);
    }
    if (auth.includes(SYNTHETIC_TOKEN)) {
      return HttpResponse.json(SYNTHETIC_ADMIN_USER);
    }

    return HttpResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }),

  // Admin dashboard
  http.get(`${API}/api/v1/admin/dashboard`, () => {
    return HttpResponse.json({
      total_hospitals: 5,
      total_ambulances: 12,
      available_ambulances: 8,
      active_emergencies: 3,
      emergencies_by_status: {
        CREATED: 1,
        ASSESSMENT_IN_PROGRESS: 1,
        SEARCHING_HOSPITAL: 0,
        ACCEPTANCE_PENDING: 1,
        HOSPITAL_CONFIRMED: 0,
        TRANSPORTING: 0,
        ARRIVED: 0,
        HANDOVER_COMPLETED: 2,
        CANCELLED: 0,
        ESCALATION_REQUIRED: 0,
      },
      total_users: 20,
    });
  }),
];
