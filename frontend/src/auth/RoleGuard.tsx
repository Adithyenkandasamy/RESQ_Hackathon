/**
 * RoleGuard: protects routes based on the authenticated user's role.
 *
 * - While auth is bootstrapping → renders a loading skeleton.
 * - Unauthenticated → redirects to /login.
 * - Wrong role → renders ForbiddenPage.
 * - Correct role → renders children.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { UserRole } from "../api/types";
import { Skeleton } from "../components/Skeleton";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { status, user } = useAuth();

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Skeleton className="h-10 w-48 rounded" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
