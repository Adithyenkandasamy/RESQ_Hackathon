import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "../lib/queryClient";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/Toast";
import { RoleGuard } from "../auth/RoleGuard";

// Pages
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { AmbulanceCrewRedirect } from "./AmbulanceCrewRedirect";
import { ForbiddenPage, NotFoundPage } from "./ErrorPages";

// Admin feature stubs
import {
  AdminDashboard,
  AdminHospitals,
  AdminAmbulances,
  AdminUsers,
  AdminEmergencies,
} from "../features/admin/index";

// Hospital feature stubs
import {
  HospitalDashboard,
  HospitalCaseList,
  HospitalCaseDetail,
  HospitalProfile,
} from "../features/hospital/index";

export function AppRouter() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/403" element={<ForbiddenPage />} />

              {/* Ambulance crew — protected but shown special screen */}
              <Route
                path="/ambulance-app"
                element={
                  <RoleGuard allowedRoles={["AMBULANCE_CREW"]}>
                    <AmbulanceCrewRedirect />
                  </RoleGuard>
                }
              />

              {/* ── Admin ─────────────────────────────────────────────── */}
              <Route
                path="/admin"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <Navigate to="/admin/dashboard" replace />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <AdminDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/hospitals"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <AdminHospitals />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/ambulances"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <AdminAmbulances />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <AdminUsers />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/emergencies"
                element={
                  <RoleGuard allowedRoles={["ADMIN"]}>
                    <AdminEmergencies />
                  </RoleGuard>
                }
              />

              {/* ── Hospital ──────────────────────────────────────────── */}
              <Route
                path="/hospital"
                element={
                  <RoleGuard allowedRoles={["HOSPITAL_STAFF", "ADMIN"]}>
                    <Navigate to="/hospital/dashboard" replace />
                  </RoleGuard>
                }
              />
              <Route
                path="/hospital/dashboard"
                element={
                  <RoleGuard allowedRoles={["HOSPITAL_STAFF", "ADMIN"]}>
                    <HospitalDashboard />
                  </RoleGuard>
                }
              />
              <Route
                path="/hospital/cases"
                element={
                  <RoleGuard allowedRoles={["HOSPITAL_STAFF", "ADMIN"]}>
                    <HospitalCaseList />
                  </RoleGuard>
                }
              />
              <Route
                path="/hospital/cases/:id"
                element={
                  <RoleGuard allowedRoles={["HOSPITAL_STAFF", "ADMIN"]}>
                    <HospitalCaseDetail />
                  </RoleGuard>
                }
              />
              <Route
                path="/hospital/profile"
                element={
                  <RoleGuard allowedRoles={["HOSPITAL_STAFF", "ADMIN"]}>
                    <HospitalProfile />
                  </RoleGuard>
                }
              />

              {/* Root redirect */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </BrowserRouter>
  );
}
