/**
 * Tests: RoleGuard component — loading, unauthenticated redirect, role matching, forbidden redirect.
 * Uses SYNTHETIC DATA (MSW) clearly labelled.
 */

import React from "react";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";

import { RoleGuard } from "../auth/RoleGuard";
import { AuthProvider } from "../auth/AuthContext";
import { setToken, clearSession } from "../auth/tokenStorage";
import { server } from "./mocks/server";
import { SYNTHETIC_TOKEN } from "./mocks/handlers";

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  clearSession();
});
afterAll(() => server.close());

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/protected"]}>
      <QueryClientProvider client={makeQueryClient()}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/403" element={<div>Forbidden</div>} />
            <Route path="/protected" element={children} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("RoleGuard", () => {
  it("redirects to /login when no session token exists", async () => {
    clearSession();
    render(
      <Wrapper>
        <RoleGuard allowedRoles={["ADMIN"]}>
          <div>Admin content</div>
        </RoleGuard>
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });

  it("renders children when user has allowed role (ADMIN)", async () => {
    setToken(SYNTHETIC_TOKEN);

    render(
      <Wrapper>
        <RoleGuard allowedRoles={["ADMIN"]}>
          <div>Admin content</div>
        </RoleGuard>
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Admin content")).toBeInTheDocument();
    });
  });

  it("redirects to /403 when user has wrong role", async () => {
    // Hospital staff token
    setToken(SYNTHETIC_TOKEN + "_hospital");

    render(
      <Wrapper>
        <RoleGuard allowedRoles={["ADMIN"]}>
          <div>Admin content</div>
        </RoleGuard>
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Forbidden")).toBeInTheDocument();
    });
  });

  it("allows HOSPITAL_STAFF to access hospital routes", async () => {
    setToken(SYNTHETIC_TOKEN + "_hospital");

    render(
      <Wrapper>
        <RoleGuard allowedRoles={["HOSPITAL_STAFF"]}>
          <div>Hospital content</div>
        </RoleGuard>
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Hospital content")).toBeInTheDocument();
    });
  });

  it("clears session and redirects to login on 401 response", async () => {
    // Token that causes /me to return 401
    setToken("invalid-token");

    render(
      <Wrapper>
        <RoleGuard allowedRoles={["ADMIN"]}>
          <div>Admin content</div>
        </RoleGuard>
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
  });
});
