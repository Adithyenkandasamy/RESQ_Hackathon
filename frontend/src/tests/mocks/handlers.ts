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

// ── Synthetic emergency fixtures ───────────────────────────────────
// SYNTHETIC DATA: not real patient records

export const SYNTHETIC_EMERGENCY_1 = {
  id: "aaa00000-0000-0000-0000-000000000001",
  created_by_id: "00000000-0000-0000-0000-000000000003",
  incident_type: "Cardiac Arrest",
  incident_description: "Unresponsive adult male",
  patient_info: {
    age: 55,
    gender: "male",
    known_conditions: "hypertension",
    blood_pressure: null,
    heart_rate: 0,
  },
  incident_latitude: 12.9716,
  incident_longitude: 77.5946,
  location_captured_at: "2026-01-15T09:00:00Z",
  status: "ACCEPTANCE_PENDING" as const,
  assigned_ambulance_id: "00000000-0000-0000-0000-000000000020",
  confirmed_hospital_id: null,
  created_at: "2026-01-15T09:00:00Z",
  updated_at: "2026-01-15T09:05:00Z",
};

export const SYNTHETIC_EMERGENCY_2 = {
  id: "bbb00000-0000-0000-0000-000000000002",
  created_by_id: "00000000-0000-0000-0000-000000000003",
  incident_type: "Road Traffic Accident",
  incident_description: null,
  patient_info: {},
  incident_latitude: 13.0,
  incident_longitude: 77.6,
  location_captured_at: "2026-01-15T10:00:00Z",
  status: "HOSPITAL_CONFIRMED" as const,
  assigned_ambulance_id: "00000000-0000-0000-0000-000000000020",
  confirmed_hospital_id: "00000000-0000-0000-0000-000000000010",
  created_at: "2026-01-15T10:00:00Z",
  updated_at: "2026-01-15T10:10:00Z",
};

export const SYNTHETIC_HOSPITAL_REQUEST_PENDING = {
  id: "req00000-0000-0000-0000-000000000001",
  emergency_id: SYNTHETIC_EMERGENCY_1.id,
  hospital_id: "00000000-0000-0000-0000-000000000010",
  status: "PENDING" as const,
  response_deadline: "2026-01-15T09:15:00Z",
  responded_at: null,
  response_reason: null,
  created_at: "2026-01-15T09:01:00Z",
};

export const SYNTHETIC_HOSPITAL_REQUEST_ACCEPTED = {
  ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
  id: "req00000-0000-0000-0000-000000000002",
  emergency_id: SYNTHETIC_EMERGENCY_2.id,
  status: "ACCEPTED" as const,
  responded_at: "2026-01-15T10:05:00Z",
};

export const SYNTHETIC_HOSPITAL_REQUEST_EXPIRED = {
  id: "req00000-0000-0000-0000-000000000003",
  emergency_id: "ccc00000-0000-0000-0000-000000000003",
  hospital_id: "00000000-0000-0000-0000-000000000010",
  status: "EXPIRED" as const,
  response_deadline: "2026-01-15T08:00:00Z",
  responded_at: null,
  response_reason: null,
  created_at: "2026-01-15T07:45:00Z",
};

export const SYNTHETIC_HOSPITAL_PROFILE = {
  id: "00000000-0000-0000-0000-000000000010",
  name: "Synthetic City Hospital",
  registration_identifier: "SCH-001",
  address: "123 Emergency Way",
  latitude: 12.9716,
  longitude: 77.5946,
  contact_number: "+1-555-0100",
  capabilities: ["ICU", "TRAUMA_LEVEL_1"],
  reported_availability: {
    accepting_patients: true,
    icu_beds_available: 4,
  },
  availability_updated_at: "2026-01-15T09:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-15T09:00:00Z",
};

export const SYNTHETIC_HISTORY_ENTRIES = [
  {
    id: "hist0000-0000-0000-0000-000000000001",
    emergency_id: SYNTHETIC_EMERGENCY_1.id,
    event_type: "CREATED",
    actor_user_id: "00000000-0000-0000-0000-000000000003",
    previous_status: null,
    new_status: "CREATED",
    details: { incident_type: "Cardiac Arrest" },
    created_at: "2026-01-15T09:00:00Z",
  },
  {
    id: "hist0000-0000-0000-0000-000000000002",
    emergency_id: SYNTHETIC_EMERGENCY_1.id,
    event_type: "STATUS_CHANGE",
    actor_user_id: "00000000-0000-0000-0000-000000000003",
    previous_status: "CREATED",
    new_status: "ACCEPTANCE_PENDING",
    details: null,
    created_at: "2026-01-15T09:02:00Z",
  },
];

// ── Handlers ──────────────────────────────────────────────────────

export const handlers = [
  // Login — success for admin, hospital staff, ambulance crew
  http.post(`${API}/api/v1/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };

    if (body.email === "admin@resq.test" && body.password === "password") {
      return HttpResponse.json({
        access_token: SYNTHETIC_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
      });
    }
    if (
      body.email === "staff@city-hospital.test" &&
      body.password === "password"
    ) {
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

  // GET /api/v1/emergencies — paginated list
  http.get(`${API}/api/v1/emergencies`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items = [SYNTHETIC_EMERGENCY_1, SYNTHETIC_EMERGENCY_2];
    if (status) {
      items = items.filter((e) => e.status === status);
    }
    return HttpResponse.json({
      items,
      total: items.length,
      page: 1,
      page_size: 20,
      total_pages: 1,
    });
  }),

  // GET /api/v1/emergencies/:id
  http.get(`${API}/api/v1/emergencies/:id`, ({ params }) => {
    const id = params.id as string;
    if (id === SYNTHETIC_EMERGENCY_1.id) {
      return HttpResponse.json(SYNTHETIC_EMERGENCY_1);
    }
    if (id === SYNTHETIC_EMERGENCY_2.id) {
      return HttpResponse.json(SYNTHETIC_EMERGENCY_2);
    }
    return HttpResponse.json(
      { detail: "Emergency incident not found." },
      { status: 404 }
    );
  }),

  // GET /api/v1/emergencies/:id/history
  http.get(`${API}/api/v1/emergencies/:id/history`, ({ params }) => {
    const id = params.id as string;
    if (id === SYNTHETIC_EMERGENCY_1.id) {
      return HttpResponse.json(SYNTHETIC_HISTORY_ENTRIES);
    }
    return HttpResponse.json([]);
  }),

  // GET /api/v1/emergencies/:id/requests
  http.get(`${API}/api/v1/emergencies/:id/requests`, ({ params }) => {
    const id = params.id as string;
    if (id === SYNTHETIC_EMERGENCY_1.id) {
      return HttpResponse.json([SYNTHETIC_HOSPITAL_REQUEST_PENDING]);
    }
    if (id === SYNTHETIC_EMERGENCY_2.id) {
      return HttpResponse.json([SYNTHETIC_HOSPITAL_REQUEST_ACCEPTED]);
    }
    return HttpResponse.json([]);
  }),

  // GET /api/v1/emergencies/:id/destination
  http.get(`${API}/api/v1/emergencies/:id/destination`, ({ params }) => {
    const id = params.id as string;
    if (id === SYNTHETIC_EMERGENCY_2.id) {
      return HttpResponse.json({
        emergency_id: SYNTHETIC_EMERGENCY_2.id,
        confirmed_hospital_id: "00000000-0000-0000-0000-000000000010",
        confirmed_hospital_name: "Synthetic City Hospital",
        status: "HOSPITAL_CONFIRMED",
      });
    }
    return HttpResponse.json({
      emergency_id: id,
      confirmed_hospital_id: null,
      confirmed_hospital_name: null,
      status: SYNTHETIC_EMERGENCY_1.status,
    });
  }),

  // POST /api/v1/hospital-requests/:id/accept
  http.post(`${API}/api/v1/hospital-requests/:id/accept`, ({ params }) => {
    const id = params.id as string;
    if (id === SYNTHETIC_HOSPITAL_REQUEST_PENDING.id) {
      return HttpResponse.json({
        ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
        status: "ACCEPTED",
        responded_at: new Date().toISOString(),
      });
    }
    return HttpResponse.json(
      { detail: "Hospital admission request not found." },
      { status: 404 }
    );
  }),

  // POST /api/v1/hospital-requests/:id/decline
  http.post(`${API}/api/v1/hospital-requests/:id/decline`, ({ params }) => {
    const id = params.id as string;
    if (id === SYNTHETIC_HOSPITAL_REQUEST_PENDING.id) {
      return HttpResponse.json({
        ...SYNTHETIC_HOSPITAL_REQUEST_PENDING,
        status: "DECLINED",
        responded_at: new Date().toISOString(),
      });
    }
    return HttpResponse.json(
      { detail: "Hospital admission request not found." },
      { status: 404 }
    );
  }),

  // GET /api/v1/hospital-requests — admission requests list
  http.get(`${API}/api/v1/hospital-requests`, ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let items = [
      SYNTHETIC_HOSPITAL_REQUEST_PENDING,
      SYNTHETIC_HOSPITAL_REQUEST_ACCEPTED,
      SYNTHETIC_HOSPITAL_REQUEST_EXPIRED,
    ];
    if (status) {
      items = items.filter((r) => r.status === status);
    }
    return HttpResponse.json(items);
  }),

  // GET /api/v1/hospitals/me — current hospital profile
  http.get(`${API}/api/v1/hospitals/me`, () => {
    return HttpResponse.json(SYNTHETIC_HOSPITAL_PROFILE);
  }),

  // PATCH /api/v1/hospitals/me/availability — update reported availability
  http.patch(`${API}/api/v1/hospitals/me/availability`, async ({ request }) => {
    const body = (await request.json()) as { reported_availability: Record<string, unknown> };
    return HttpResponse.json({
      ...SYNTHETIC_HOSPITAL_PROFILE,
      reported_availability: {
        ...SYNTHETIC_HOSPITAL_PROFILE.reported_availability,
        ...body.reported_availability,
      },
      availability_updated_at: new Date().toISOString(),
    });
  }),
];
