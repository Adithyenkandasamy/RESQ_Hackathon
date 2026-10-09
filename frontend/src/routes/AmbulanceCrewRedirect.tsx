import React from "react";
import { Link } from "react-router-dom";

/**
 * Shown to AMBULANCE_CREW users who log in via the web portal.
 * They must use the dedicated ambulance mobile app.
 */
export function AmbulanceCrewRedirect() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="max-w-[420px] w-full text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF3C7] mx-auto mb-4">
          <svg
            className="h-7 w-7 text-[#D97706]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>

        <h1 className="text-[20px] font-semibold text-navy mb-2">
          Use the Ambulance App
        </h1>
        <p className="text-[14px] text-navy-secondary mb-6 leading-relaxed">
          Your account is registered as <strong>Ambulance Crew</strong>. This
          web portal is for hospital staff and administrators only.
        </p>
        <p className="text-[14px] text-navy-secondary mb-6">
          Please use the dedicated <strong>RESQ Ambulance App</strong> on your
          mobile device to dispatch and manage emergencies.
        </p>

        <Link
          to="/login"
          className="inline-flex items-center rounded-md border border-outline-variant bg-white px-4 py-2 text-sm font-medium text-navy hover:bg-surface-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
