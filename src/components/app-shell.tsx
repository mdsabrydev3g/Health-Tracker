"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { useApp } from "@/lib/store";
import { ToastHost, Badge, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { registerServiceWorker } from "@/lib/notify";

const MAIN_NAV = [
  { href: "/", label: "اليوم", icon: "☀️" },
  { href: "/medications", label: "الأدوية", icon: "💊" },
  { href: "/inventory", label: "المخزون", icon: "📦" },
  { href: "/reports", label: "التقارير", icon: "📈" },
];

const MORE_NAV = [
  { href: "/calendar", label: "التقويم" },
  { href: "/labs", label: "الملفات الطبية" },
  { href: "/daily", label: "الأعراض والطعام" },
  { href: "/people", label: "الأشخاص" },
  { href: "/emergency", label: "بطاقة الطوارئ" },
  { href: "/backup", label: "النسخ الاحتياطي" },
  { href: "/audit", label: "سجل التغييرات" },
  { href: "/settings", label: "الإعدادات" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { persons, selectedPersonId, loadPersons, selectPerson } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    loadPersons();
    registerServiceWorker();
  }, [loadPersons]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col pb-20">
      <ToastHost />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-brand-700 dark:text-brand-300">
            <span aria-hidden>❤️‍🩹</span>
            <span>Health Tracker</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/mother"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-bold text-white"
              title="وضع الوالدة"
            >
              وضع الأم
            </Link>
            {persons.length > 1 && (
              <Select
                aria-label="اختيار الشخص"
                value={selectedPersonId ?? ""}
                onChange={(e) => selectPerson(e.target.value)}
                className="!min-h-0 !w-auto !py-1 text-sm"
              >
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr}
                  </option>
                ))}
              </Select>
            )}
            <button
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600"
              title="تسجيل الخروج"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">{children}</main>

      {/* Bottom nav (mobile-first) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        aria-label="التنقل الرئيسي"
      >
        {MAIN_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold",
              pathname === item.href ? "text-brand-600 dark:text-brand-300" : "text-slate-500",
            )}
          >
            <span className="text-xl" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={clsx(
            "flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold",
            moreOpen || MORE_NAV.some((m) => pathname.startsWith(m.href))
              ? "text-brand-600 dark:text-brand-300"
              : "text-slate-500",
          )}
        >
          <span className="text-xl" aria-hidden>
            ⋯
          </span>
          المزيد
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-3xl px-3">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            {MORE_NAV.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="flex min-h-touch items-center rounded-xl px-4 font-semibold hover:bg-brand-50 dark:hover:bg-slate-700"
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
