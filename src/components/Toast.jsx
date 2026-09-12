"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-accent/15 text-accent",
    bar: "bg-accent",
  },
  error: {
    icon: XCircle,
    iconWrap: "bg-primary/10 text-primary",
    bar: "bg-primary",
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: "bg-accent/15 text-accent",
    bar: "bg-accent",
  },
  info: {
    icon: Info,
    iconWrap: "bg-primary/10 text-primary",
    bar: "bg-primary",
  },
};

function inferType(message, type) {
  if (type) return type;
  const text = String(message || "");
  if (/^error:|^failed|could not|invalid|denied|unauthorized/i.test(text)) {
    return "error";
  }
  return "success";
}

function ToastItem({ toast, onDismiss }) {
  const [phase, setPhase] = useState("enter");
  const leaveTimer = useRef(null);
  const autoTimer = useRef(null);
  const variant = VARIANTS[toast.type] || VARIANTS.info;
  const Icon = variant.icon;
  const leaving = phase === "leave";

  const dismiss = useCallback(() => {
    setPhase((current) => {
      if (current === "leave") return current;
      return "leave";
    });
  }, []);

  useEffect(() => {
    if (phase !== "leave") return;
    leaveTimer.current = setTimeout(() => onDismiss(toast.id), 320);
    return () => clearTimeout(leaveTimer.current);
  }, [phase, onDismiss, toast.id]);

  useEffect(() => {
    const enter = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("shown"));
    });
    autoTimer.current = setTimeout(dismiss, toast.duration);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(autoTimer.current);
    };
  }, [dismiss, toast.duration]);

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{ gridTemplateRows: leaving ? "0fr" : "1fr" }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          className={`pointer-events-auto relative mb-2 overflow-hidden w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-line bg-surface text-ink shadow-[0_18px_50px_-24px_rgba(31,42,36,0.55)] backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            phase === "shown"
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 -translate-y-3 scale-[0.98]"
          }`}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${variant.iconWrap}`}
            >
              <Icon size={16} />
            </span>
            <p className="flex-1 text-sm leading-5 font-medium text-ink">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss notification"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink hover:bg-primary/5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <span
            className={`absolute left-0 bottom-0 h-[3px] ${variant.bar} origin-left animate-toast-bar`}
            style={{ animationDuration: `${toast.duration}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, options = {}) => {
    const text = String(message || "").trim();
    if (!text) return;
    const id = ++idRef.current;
    const type = inferType(text, options.type);
    const duration =
      Number(options.duration) || (type === "error" ? 4200 : 2800);
    setToasts((prev) => [{ id, message: text, type, duration }, ...prev].slice(0, 5));
    return id;
  }, []);

  const api = useMemo(
    () => ({
      toast,
      success: (message, options) =>
        toast(message, { ...options, type: "success" }),
      error: (message, options) => toast(message, { ...options, type: "error" }),
      warning: (message, options) =>
        toast(message, { ...options, type: "warning" }),
      info: (message, options) => toast(message, { ...options, type: "info" }),
      dismiss,
    }),
    [dismiss, toast],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center px-3 sm:top-5">
        {toasts.map((item) => (
          <ToastItem key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
