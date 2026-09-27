"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

// ---------- Button ----------
export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const variants: Record<string, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
    success: "bg-green-600 text-white hover:bg-green-700",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-700",
    outline:
      "border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700",
  };
  const sizes: Record<string, string> = {
    sm: "min-h-touch px-3 text-sm",
    md: "min-h-touch px-4 text-base",
    lg: "min-h-touch px-6 text-lg",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(base, variants[variant], sizes[size], className)}
    >
      {children}
    </button>
  );
}

// ---------- Card ----------
export function Card({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={clsx("card p-4", onClick && "cursor-pointer hover:shadow-md", className)}
    >
      {children}
    </div>
  );
}

// ---------- Form fields ----------
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="block text-xs muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full min-h-touch rounded-xl px-3 py-2 border border-slate-300 dark:border-slate-600 bg-transparent focus:border-brand-500";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(inputCls, "min-h-24", props.className)} />;
}

// ---------- Badge ----------
export function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200",
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    red: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    gray: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  };
  return (
    <span className={clsx("inline-block rounded-full px-3 py-0.5 text-xs font-bold", colors[color])}>
      {children}
    </span>
  );
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 dark:bg-slate-800 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="min-h-touch px-2 text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Spinner / Empty ----------
export function Spinner() {
  return (
    <div className="flex justify-center py-10" role="status" aria-label="جارٍ التحميل">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="mt-1 text-sm muted">{hint}</p>}
    </div>
  );
}

// ---------- Toast ----------
let toastHandler: ((msg: string, kind?: "ok" | "err") => void) | null = null;
export function registerToast(fn: (msg: string, kind?: "ok" | "err") => void) {
  toastHandler = fn;
}
export function toast(msg: string, kind: "ok" | "err" = "ok") {
  toastHandler?.(msg, kind);
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; msg: string; kind: "ok" | "err" }[]>([]);
  useEffect(() => {
    registerToast((msg, kind = "ok") => {
      const id = Date.now() + Math.random();
      setItems((xs) => [...xs, { id, msg, kind }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
    });
  }, []);
  return (
    <div className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 space-y-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={clsx(
            "rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg",
            t.kind === "ok" ? "bg-green-600" : "bg-red-600",
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ---------- Numbers (Eastern/Western toggle handled by caller; default Western) ----------
export function fmtNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const x = typeof n === "number" ? n : parseFloat(n);
  return Number.isFinite(x) ? String(Math.round(x * 100) / 100) : "—";
}

export const FOOD_RULE_AR: Record<string, string> = {
  with: "مع الأكل",
  before: "قبل الأكل",
  after: "بعد الأكل",
  emptyStomach: "على معدة فارغة",
  avoid: "تجنّب مع",
  none: "—",
};

export const FORM_AR: Record<string, string> = {
  tablet: "قرص",
  capsule: "كبسولة",
  syrup: "شراب",
  injection: "حقن",
  drops: "نقط",
  inhaler: "بخاخ",
  patch: "لصقة",
  other: "أخرى",
};

export const STATUS_AR: Record<string, string> = {
  upcoming: "قادمة",
  due: "الآن",
  taken: "تم الأخذ",
  missed: "فاتت",
  skipped: "تم التخطي",
  snoozed: "مؤجلة",
  cancelled: "ملغاة",
  active: "نشط",
  paused: "متوقف",
  finished: "منتهي",
  discontinued: "موقوف",
};
