/**
 * Tests: Login flow — form validation, successful login, wrong credentials, role-based redirect.
 * Uses SYNTHETIC DATA (MSW) clearly labelled.
 */

import React from "react";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

import { AuthProvider } from "../auth/AuthContext";
import { LoginPage } from "../routes/LoginPage";
import { clearSession } from "../auth/tokenStorage";
import { server } from "./mocks/server";
import { ToastProvider } from "../components/Toast";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => { server.resetHandlers(); clearSession(); });
afterAll(() => server.close());

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function TestApp({ initialPath = "/login" }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/admin/dashboard" element={<div>Admin Dashboard</div>} />
              <Route path="/admin" element={<div>Admin Dashboard</div>} />
              <Route path="/hospital/dashboard" element={<div>Hospital Dashboard</div>} />
              <Route path="/hospital" element={<div>Hospital Dashboard</div>} />
              <Route path="/ambulance-app" element={<div>Ambulance App Screen</div>} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  it("renders the sign-in form", () => {
    render(<TestApp />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it("shows error on invalid credentials", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.type(screen.getByLabelText(/email address/i), "wrong@test.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("redirects ADMIN to /admin after successful login", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.type(screen.getByLabelText(/email address/i), "admin@resq.test");
    await user.type(screen.getByLabelText(/password/i), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });
  });

  it("redirects HOSPITAL_STAFF to /hospital after successful login", async () => {
    const user = userEvent.setup();
    render(<TestApp />);

    await user.type(screen.getByLabelText(/email address/i), "staff@city-hospital.test");
    await user.type(screen.getByLabelText(/password/i), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Hospital Dashboard")).toBeInTheDocument();
    });
  });
});
