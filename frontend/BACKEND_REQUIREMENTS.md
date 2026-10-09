# RESQ Frontend – Backend Requirements & Gap Analysis

This document tracks backend features, endpoints, and schema details needed by the Admin and Hospital web portals that are currently missing, incomplete, or require backend enhancement. The frontend degrades gracefully when encountering missing capabilities (showing disabled states, tooltip explanations, and "Backend Endpoint Required" indicators).

---

## Summary of Identified Gaps

| Area | Missing Capability | Current Backend State | Frontend Mitigation |
|---|---|---|---|
| **Admin Fleet** | Admin Ambulance List & CRUD (`GET /api/v1/admin/ambulances`, `POST`, `PATCH`, `DELETE`) | Only `GET /api/v1/ambulances/my` (crew-scoped) and `PATCH /api/v1/ambulances/{id}/availability` exist | Renders `<BackendEndpointRequired>` with clear specification on the Admin Ambulances page |
| **Admin Users** | User Management (`GET /api/v1/admin/users`, `POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}`) | Only `POST /auth/login` and `GET /auth/me` exist | Renders `<BackendEndpointRequired>` explaining that user administration endpoints are needed |
| **Hospital Directory** | Search & Tier filtering parameters on `GET /api/v1/hospitals/` | Basic list returns all hospitals without pagination or search filters | Client-side search and filtering applied on fetched list |
| **Ambulance Live GPS** | WebSocket event schema for ambulance location streams | Socket.IO connection supported but explicit typed payload not in `openapi.json` | Real-time map client gracefully handles coordinate updates with fallback polling |
| **Handover Documentation** | Detailed post-admission outcome tracking | `HANDOVER_COMPLETED` is a terminal emergency state | Hospital portal completes handover state; logs outcome notes locally |

---

## Detailed Endpoint Specifications for Backend Team

### 1. Admin Ambulance Management

- **`GET /api/v1/admin/ambulances`**
  - **Auth**: `ADMIN`
  - **Query Params**: `status` (AmbulanceStatus), `search` (string), `skip` (int), `limit` (int)
  - **Response**: `List[AmbulanceResponse]` with pagination meta.

- **`POST /api/v1/admin/ambulances`**
  - **Auth**: `ADMIN`
  - **Body**: `{ registration_identifier: string, contact_number?: string, operational_status: AmbulanceStatus }`
  - **Response**: `AmbulanceResponse`

- **`PATCH /api/v1/admin/ambulances/{id}`**
  - **Auth**: `ADMIN`
  - **Body**: `{ registration_identifier?: string, contact_number?: string, operational_status?: AmbulanceStatus }`
  - **Response**: `AmbulanceResponse`

- **`DELETE /api/v1/admin/ambulances/{id}`**
  - **Auth**: `ADMIN`
  - **Response**: `204 No Content`

---

### 2. Admin User Management

- **`GET /api/v1/admin/users`**
  - **Auth**: `ADMIN`
  - **Query Params**: `role` (UserRole), `hospital_id` (UUID), `is_active` (bool), `skip` (int), `limit` (int)
  - **Response**: `List[UserResponse]`

- **`POST /api/v1/admin/users`**
  - **Auth**: `ADMIN`
  - **Body**: `{ email: string, password: string, role: UserRole, hospital_id?: UUID, ambulance_id?: UUID }`
  - **Response**: `UserResponse`

- **`PATCH /api/v1/admin/users/{id}`**
  - **Auth**: `ADMIN`
  - **Body**: `{ is_active?: bool, role?: UserRole, hospital_id?: UUID, ambulance_id?: UUID }`
  - **Response**: `UserResponse`

---

### 3. Real-Time Socket.IO Channels

- **Channel: `emergency:{emergency_id}`**
  - Event `status_updated`: `{ emergency_id: string, status: EmergencyStatus, timestamp: string }`
  - Event `vitals_updated`: `{ emergency_id: string, vitals: VitalSigns, timestamp: string }`
  - Event `location_updated`: `{ emergency_id: string, lat: number, lng: number, eta_seconds: number }`

- **Channel: `hospital:{hospital_id}`**
  - Event `request_received`: `HospitalRequestResponse`
  - Event `request_expired`: `{ request_id: string }`
