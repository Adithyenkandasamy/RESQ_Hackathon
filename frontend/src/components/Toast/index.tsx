import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useEffect,
} from "react";
import { cn } from "../../lib/cn";

// ── Types ─────────────────────────────────────────────────────────

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // ms, default 4000
}

type ToastAction =
  | { type: "ADD"; toast: Toast }
  | { type: "REMOVE"; id: string };

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "ADD":
      return [...state.slice(-4), action.toast]; // cap at 5 visible
    case "REMOVE":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let _addToast: ((msg: string, v?: ToastVariant, d?: number) => void) | null = null;

/** Imperative accessor for use outside of React tree (e.g. socket handlers). */
export function showToast(
  message: string,
  variant: ToastVariant = "info",
  duration?: number
) {
  _addToast?.(message, variant, duration);
}

// ── Provider ──────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 4000) => {
      const id = `${Date.now()}-${Math.random()}`;
      dispatch({ type: "ADD", toast: { id, message, variant, duration } });
    },
    []
  );

  // Expose imperatively
  useEffect(() => {
    _addToast = addToast;
    return () => { _addToast = null; };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── UI ────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: "bg-[#E0F2FE] border-[#BAE6FD] text-[#006194]",
  success: "bg-[#DCFCE7] border-[#86EFAC] text-[#16A34A]",
  warning: "bg-[#FEF3C7] border-[#FDE68A] text-[#D97706]",
  error: "bg-[#FEE2E2] border-[#FCA5A5] text-[#ba1a1a]",
};

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 shadow-md text-sm font-medium max-w-sm w-full transition-all",
        VARIANT_STYLES[toast.variant]
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onClose}
        className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}
