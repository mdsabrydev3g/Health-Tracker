"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Field, Input, Select, toast } from "@/components/ui";
import { hashPasswordClient } from "@/lib/pin";
import clsx from "clsx";

type Theme = "light" | "dark" | "auto";
type Numerals = "western" | "eastern";

interface Prefs {
  theme: Theme;
  numerals: Numerals;
  lowStockDays: number;
}

const DEFAULT_PREFS: Prefs = { theme: "auto", numerals: "western", lowStockDays: 3 };

function readLocalPrefs(): Prefs {
  try {
    return {
      theme: (localStorage.getItem("ht_theme") as Theme | null) ?? DEFAULT_PREFS.theme,
      numerals: (localStorage.getItem("ht_numerals") as Numerals | null) ?? DEFAULT_PREFS.numerals,
      lowStockDays: Number(localStorage.getItem("ht_lowstock") ?? DEFAULT_PREFS.lowStockDays) || DEFAULT_PREFS.lowStockDays,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export default function SettingsPage() {
  const [notifPerm, setNotifPerm] = useState<string>("default");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [pin, setPin] = useState("");
  const prefsRef = useRef<Prefs>(DEFAULT_PREFS);
  const mounted = useRef(false);

  /** Merge + persist locally (localStorage) and fire-and-forget sync to the server. */
  const savePrefs = useCallback((patch: Partial<Prefs>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    try {
      localStorage.setItem("ht_theme", next.theme);
      localStorage.setItem("ht_numerals", next.numerals);
      localStorage.setItem("ht_lowstock", String(next.lowStockDays));
    } catch {}
    api("/api/settings", { method: "PUT", body: { key: "prefs", value: { ...next } } }).catch(() => {});
  }, []);

  useEffect(() => {
    const local = readLocalPrefs();
    prefsRef.current = local;
    setPrefs(local);
    applyTheme(local.theme);
    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);
    mounted.current = true;
  }, []);

  function setTheme(theme: Theme) {
    savePrefs({ theme });
    applyTheme(theme);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      toast("هذا المتصفح لا يدعم الإشعارات", "err");
      return;
    }
    try {
      const p = await Notification.requestPermission();
      setNotifPerm(p);
      if (p === "granted") toast("تم تفعيل الإشعارات ✅");
      else if (p === "denied") toast("تم رفض الإشعارات من المتصفح", "err");
      else toast("لم يتم تحديد إذن الإشعارات");
    } catch {
      toast("تعذر تفعيل الإشعارات", "err");
    }
  }

  const PERM_AR: Record<string, string> = {
    granted: "مفعّلة",
    denied: "مرفوضة",
    default: "غير مفعّلة",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">الإعدادات</h1>
        <p className="text-sm muted">تخصيص التطبيق بما يناسب عائلتك</p>
      </div>

      {/* Notifications */}
      <Card className="space-y-2">
        <h2 className="font-bold">الإشعارات</h2>
        <p className="text-sm muted">
          الحالة الحالية: <span className="font-semibold">{PERM_AR[notifPerm] ?? notifPerm}</span>
        </p>
        <Button onClick={enableNotifications} disabled={notifPerm === "granted"}>
          تفعيل الإشعارات
        </Button>
        <p className="text-xs muted">
          على أندرويد عبر تطبيق Health Tracker (Capacitor) تُدار التذكيرات من النظام.
        </p>
      </Card>

      {/* Theme */}
      <Card className="space-y-2">
        <h2 className="font-bold">المظهر</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["light", "فاتح"],
              ["dark", "داكن"],
              ["auto", "تلقائي"],
            ] as [Theme, string][]
          ).map(([v, label]) => (
            <Button key={v} variant={prefs.theme === v ? "primary" : "outline"} onClick={() => setTheme(v)}>
              {label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Numerals */}
      <Card className="space-y-2">
        <h2 className="font-bold">الأرقام</h2>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["western", "غربية (0-9)"],
              ["eastern", "شرقية (٠-٩)"],
            ] as [Numerals, string][]
          ).map(([v, label]) => (
            <Button
              key={v}
              variant={prefs.numerals === v ? "primary" : "outline"}
              onClick={() => savePrefs({ numerals: v })}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-sm muted">
          نموذج:{" "}
          <span className={clsx("text-lg font-bold", prefs.numerals === "eastern" && "tracking-wide")}>
            {prefs.numerals === "eastern" ? "١٢:٣٠" : "12:30"}
          </span>
        </p>
      </Card>

      {/* Low stock threshold */}
      <Card className="space-y-2">
        <h2 className="font-bold">حدود التنبيه</h2>
        <Field label="تنبيه نقص الدواء قبل النفاد بـ" hint="سننبيهك عندما يكفي المخزون لهذا العدد من الأيام أو أقل">
          <Select
            value={String(prefs.lowStockDays)}
            onChange={(e) => savePrefs({ lowStockDays: Number(e.target.value) })}
          >
            <option value="1">يوم واحد</option>
            <option value="2">يومان</option>
            <option value="3">٣ أيام</option>
            <option value="5">٥ أيام</option>
            <option value="7">٧ أيام</option>
          </Select>
        </Field>
      </Card>

      {/* Caregiver PIN (Mother Mode exit) */}
      <Card className="space-y-2">
        <h2 className="font-bold">رمز مقدم الرعاية</h2>
        <p className="text-sm muted">
          رمز سري للخروج من «وضع الأم» على جهاز الوالدة — 4 أرقام على الأقل.
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="!w-32"
          />
          <Button
            disabled={pin.length < 4}
            onClick={() => {
              localStorage.setItem("ht_caregiver_pin", hashPasswordClient(pin));
              setPin("");
              toast("تم حفظ الرمز ✅");
            }}
          >
            حفظ الرمز
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card className="space-y-1">
        <h2 className="font-bold">حول</h2>
        <p className="text-sm">
          Health Tracker — <span className="muted">الإصدار 1.0.0</span>
        </p>
        <p className="text-xs muted">
          هذا التطبيق أداة تذكير وتسجيل فقط وليس جهازاً طبياً ولا يقدم نصائح طبية.
        </p>
      </Card>
    </div>
  );
}
