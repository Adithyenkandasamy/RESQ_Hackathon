/**
 * Hospital Registration — /register
 *
 * Public self-service form for hospitals to apply for system access.
 * Creates a PENDING registration that an administrator must approve before
 * the hospital staff account can sign in.
 */

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "../components/FormField";
import { registerHospital } from "../api/hospitals";
import { extractErrorMessage, mapValidationErrors } from "../api/client";
import type { AxiosError } from "axios";
import type { HospitalRegisterResponse } from "../api/types";
import { cn } from "../lib/cn";

const schema = z
  .object({
    name: z.string().min(2, "Enter the hospital name."),
    registration_identifier: z
      .string()
      .min(2, "Enter a registration identifier (e.g. HOSP-METRO-01)."),
    address: z.string().min(5, "Enter the full street address."),
    latitude: z.coerce
      .number({ invalid_type_error: "Enter a valid latitude." })
      .min(-90)
      .max(90, "Latitude must be between -90 and 90."),
    longitude: z.coerce
      .number({ invalid_type_error: "Enter a valid longitude." })
      .min(-180)
      .max(180, "Longitude must be between -180 and 180."),
    contact_number: z.string().min(5, "Enter the emergency contact number."),
    capabilities: z.string().optional(),
    applicant_email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm_password: z.string().min(1, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match.",
  });

type FormData = z.infer<typeof schema>;

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function RegisterPage() {
  const [submitted, setSubmitted] = useState<HospitalRegisterResponse | null>(null);
  const [rootError, setRootError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setValue("latitude", 37.7749, { shouldValidate: true });
      setValue("longitude", -122.4194, { shouldValidate: true });
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue("latitude", parseFloat(pos.coords.latitude.toFixed(4)), { shouldValidate: true });
        setValue("longitude", parseFloat(pos.coords.longitude.toFixed(4)), { shouldValidate: true });
        setDetectingGps(false);
      },
      () => {
        setValue("latitude", 37.7749, { shouldValidate: true });
        setValue("longitude", -122.4194, { shouldValidate: true });
        setDetectingGps(false);
      },
      { timeout: 6000 }
    );
  };

  const handlePrefillDemo = () => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setValue("name", `City Care Hospital ${randomSuffix}`, { shouldValidate: true });
    setValue("registration_identifier", `HOSP-CARE-${randomSuffix}`, { shouldValidate: true });
    setValue("contact_number", "+1-555-0199", { shouldValidate: true });
    setValue("address", "450 Health Ave, District 4", { shouldValidate: true });
    setValue("latitude", 37.7749, { shouldValidate: true });
    setValue("longitude", -122.4194, { shouldValidate: true });
    setValue("capabilities", "ICU, TRAUMA_LEVEL_1, CARDIAC", { shouldValidate: true });
    setValue("applicant_email", `staff.care${randomSuffix}@hospital.org`, { shouldValidate: true });
    setValue("password", "Hospital123!", { shouldValidate: true });
    setValue("confirm_password", "Hospital123!", { shouldValidate: true });
  };

  const onSubmit = async (data: FormData) => {
    setRootError(null);
    setIsSubmitting(true);
    try {
      const capabilities = (data.capabilities ?? "")
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      const res = await registerHospital({
        name: data.name,
        registration_identifier: data.registration_identifier,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        contact_number: data.contact_number,
        capabilities,
        applicant_email: data.applicant_email,
        password: data.password,
      });
      setSubmitted(res);
    } catch (err) {
      const msg = extractErrorMessage(err);
      const ve = mapValidationErrors(err as AxiosError);
      const keys = Object.keys(ve);
      if (keys.length > 0) {
        for (const key of keys) {
          const field = key.split(".").pop();
          if (!field) continue;
          if (field in data) {
            setError(field as keyof FormData, { message: ve[key] });
          }
        }
      }

      if (msg.toLowerCase().includes("email")) {
        setError("applicant_email", { message: msg });
      } else if (msg.toLowerCase().includes("identifier")) {
        setError("registration_identifier", { message: msg });
      }
      setRootError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-[460px]">
          <div className="rounded-lg border border-outline-variant bg-white px-6 py-8 shadow-sm text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
              <CheckIcon />
            </div>
            <h1 className="mt-4 text-[18px] font-semibold text-navy tracking-tight">
              Registration submitted
            </h1>
            <div className="mt-3 rounded-md border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-[13px] text-[#92400E] font-medium text-left">
              <p className="font-bold text-navy">
                {submitted.name}{" "}
                <span className="font-mono text-navy-secondary">
                  [{submitted.registration_identifier}]
                </span>
              </p>
              <p className="mt-1">{submitted.message}</p>
            </div>

            <div className="mt-4 rounded-md border border-outline-variant bg-surface px-4 py-3 text-[12px] text-navy-secondary text-left space-y-1">
              <p className="font-semibold text-navy">How approval works:</p>
              <p>
                1. Sign in as Administrator (<span className="font-mono text-primary">admin@ercs.org</span> / <span className="font-mono text-primary">Admin123!</span>).
              </p>
              <p>
                2. Navigate to <strong>Hospitals</strong> tab and click <strong>Approve</strong> on {submitted.name}.
              </p>
              <p>
                3. Your staff account (<span className="font-mono text-primary">{submitted.applicant_email}</span>) will immediately be activated to sign in.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              <Link
                to="/login"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-white text-[14px] font-semibold hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[520px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white text-lg font-bold mb-3 shadow-sm">
            R
          </div>
          <h1 className="text-[24px] font-semibold text-navy tracking-tight">
            Hospital Registration
          </h1>
          <p className="text-[13px] text-navy-secondary mt-1 text-center">
            Apply for access to the Emergency Response Coordination System.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-outline-variant bg-white px-6 py-7 shadow-sm">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-[16px] font-semibold text-navy">
                Hospital &amp; staff details
              </h2>
              <p className="text-[12px] text-navy-secondary">
                Your application is queued for administrative review before staff can sign in.
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrefillDemo}
              className="shrink-0 text-[11px] font-semibold text-primary hover:text-primary-hover bg-primary/10 px-2.5 py-1 rounded transition-colors"
            >
              Fill Sample Data
            </button>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4 mt-5"
          >
            <FormField
              id="name"
              label="Hospital name"
              placeholder="e.g. Metro General Hospital"
              required
              error={errors.name}
              registration={register("name")}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="registration_identifier"
                label="Registration ID"
                placeholder="HOSP-METRO-01"
                required
                error={errors.registration_identifier}
                registration={register("registration_identifier")}
              />
              <FormField
                id="contact_number"
                label="Emergency contact"
                placeholder="+1 555 0100"
                required
                error={errors.contact_number}
                registration={register("contact_number")}
              />
            </div>

            <FormField
              id="address"
              label="Street address"
              placeholder="100 Healthcare Way, Metro City"
              required
              error={errors.address}
              registration={register("address")}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium text-navy">Coordinates</span>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingGps}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  {detectingGps ? "Detecting GPS…" : "📍 Detect current location"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  id="latitude"
                  label="Latitude"
                  type="number"
                  step="any"
                  placeholder="37.7749"
                  required
                  error={errors.latitude}
                  registration={register("latitude")}
                />
                <FormField
                  id="longitude"
                  label="Longitude"
                  type="number"
                  step="any"
                  placeholder="-122.4194"
                  required
                  error={errors.longitude}
                  registration={register("longitude")}
                />
              </div>
            </div>

            <FormField
              id="capabilities"
              label="Capabilities"
              placeholder="ICU, TRAUMA, CARDIAC (comma separated)"
              hint="Optional — facilities and specialties supported by your hospital."
              error={errors.capabilities}
              registration={register("capabilities")}
            />

            <div className="border-t border-outline-variant my-1" />

            <FormField
              id="applicant_email"
              label="Staff account email"
              type="email"
              placeholder="er@yourhospital.org"
              required
              error={errors.applicant_email}
              registration={register("applicant_email")}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                id="password"
                label="Password"
                type="password"
                placeholder="Minimum 8 characters"
                required
                hint="Used by hospital staff to sign in after approval."
                error={errors.password}
                registration={register("password")}
              />
              <FormField
                id="confirm_password"
                label="Confirm password"
                type="password"
                placeholder="Repeat password"
                required
                error={errors.confirm_password}
                registration={register("confirm_password")}
              />
            </div>

            {rootError && (
              <p
                role="alert"
                className="rounded-md border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[13px] text-[#ba1a1a] font-medium"
              >
                {rootError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "mt-1 h-10 w-full rounded-md bg-primary text-white text-[14px] font-semibold transition-colors",
                "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isSubmitting && "opacity-60 cursor-not-allowed"
              )}
            >
              {isSubmitting ? "Submitting…" : "Submit application"}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-outline mt-5">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}