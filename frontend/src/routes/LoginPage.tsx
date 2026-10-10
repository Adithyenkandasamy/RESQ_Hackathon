import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { FormField } from "../components/FormField";
import { extractErrorMessage } from "../api/client";
import { cn } from "../lib/cn";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login, status, sessionExpiredMessage } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login(data);
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError("root", { message: msg });
    }
  };

  // Prevent re-submitting while already authenticated
  const isLoading = status === "loading" || isSubmitting;

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white text-lg font-bold mb-3 shadow-sm">
            R
          </div>
          <h1 className="text-[24px] font-semibold text-navy tracking-tight">
            RESQ
          </h1>
          <p className="text-[13px] text-navy-secondary mt-1">
            Emergency Response Coordination
          </p>
        </div>

        {/* Session expired banner */}
        {sessionExpiredMessage && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-[13px] text-[#D97706] font-medium"
          >
            {sessionExpiredMessage}
          </div>
        )}

        {/* Card */}
        <div className="rounded-lg border border-outline-variant bg-white px-6 py-7 shadow-sm">
          <h2 className="text-[16px] font-semibold text-navy mb-5">Sign in</h2>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <FormField
              id="email"
              label="Email address"
              type="email"
              placeholder="you@hospital.org"
              required
              error={errors.email}
              registration={register("email")}
            />

            <FormField
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              required
              error={errors.password}
              registration={register("password")}
            />

            {errors.root && (
              <div
                role="alert"
                className={cn(
                  "rounded-md border px-3 py-2.5 text-[13px] font-medium",
                  errors.root.message?.toLowerCase().includes("pending")
                    ? "border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]"
                    : "border-[#FCA5A5] bg-[#FEE2E2] text-[#ba1a1a]"
                )}
              >
                <p>{errors.root.message}</p>
                {errors.root.message?.toLowerCase().includes("pending") && (
                  <p className="mt-1.5 text-[12px] text-[#78350F]">
                    Tip: You can sign in with the Administrator account (<strong>admin@ercs.org</strong> / <strong>Admin123!</strong>) to review and approve the hospital application.
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "mt-1 h-10 w-full rounded-md bg-primary text-white text-[14px] font-semibold transition-colors",
                "hover:bg-[#004b73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isLoading && "opacity-60 cursor-not-allowed"
              )}
            >
              {isLoading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Hospital self-registration entry point */}
        <div className="mt-4 rounded-md border border-outline-variant bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-[13px] text-navy">
            New hospital?{" "}
            <Link
              to="/register"
              className="font-semibold text-primary hover:underline"
            >
              Register your facility
            </Link>
          </p>
          <p className="text-[12px] text-navy-secondary mt-0.5">
            Applications are reviewed and approved by an administrator.
          </p>
        </div>

        <p className="text-center text-[12px] text-outline mt-5">
          Emergency Response Coordination System · Admin &amp; Hospital Portal
        </p>
      </div>
    </div>
  );
}
