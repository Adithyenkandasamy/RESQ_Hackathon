import React from "react";
import { cn } from "../../lib/cn";
import type { UseFormRegister, FieldError } from "react-hook-form";

interface FormFieldProps {
  id: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  error?: FieldError | { message?: string };
  required?: boolean;
  disabled?: boolean;
  className?: string;
  step?: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registration?: ReturnType<UseFormRegister<any>>;
  children?: React.ReactNode; // allow custom inputs (textarea, select)
  hint?: string;
}

export function FormField({
  id,
  label,
  type = "text",
  placeholder,
  error,
  required,
  disabled,
  className,
  step,
  registration,
  children,
  hint,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className="text-[13px] font-medium text-navy leading-5"
      >
        {label}
        {required && (
          <span className="text-[#ba1a1a] ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {hint && (
        <p id={hintId} className="text-[12px] text-navy-secondary -mt-0.5">
          {hint}
        </p>
      )}

      {children ?? (
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          step={step}
          aria-invalid={!!error}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            "h-[38px] rounded-md border px-3 text-[14px] text-navy placeholder:text-outline bg-white transition-colors",
            "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30",
            error
              ? "border-[#ba1a1a] ring-1 ring-[#ba1a1a]/20"
              : "border-outline-variant",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          {...registration}
        />
      )}

      {error?.message && (
        <p id={errorId} role="alert" className="text-[12px] text-[#ba1a1a] font-medium">
          {error.message}
        </p>
      )}
    </div>
  );
}
