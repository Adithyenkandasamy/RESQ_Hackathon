import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function ForbiddenPage() {
  const { user } = useAuth();

  const homeLink =
    user?.role === "ADMIN"
      ? "/admin"
      : user?.role === "HOSPITAL_STAFF"
      ? "/hospital"
      : "/login";

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="max-w-[380px] w-full text-center">
        <p className="text-5xl font-bold text-primary mb-4">403</p>
        <h1 className="text-[20px] font-semibold text-navy mb-2">
          Permission Denied
        </h1>
        <p className="text-[14px] text-navy-secondary mb-6">
          You don't have permission to access this page. Contact your
          administrator if you believe this is an error.
        </p>
        <Link
          to={homeLink}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#004b73] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="max-w-[380px] w-full text-center">
        <p className="text-5xl font-bold text-primary mb-4">404</p>
        <h1 className="text-[20px] font-semibold text-navy mb-2">
          Page Not Found
        </h1>
        <p className="text-[14px] text-navy-secondary mb-6">
          The page you were looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#004b73] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
