"use client";

/** Small typed fetch wrapper for the app's REST API. */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function todayStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function arDate(localDay: string): string {
  const [y, m, d] = localDay.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${AR_DAYS[wd]} ${d} ${AR_MONTHS[m - 1]} ${y}`;
}

export function arTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const period = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${period}`;
}

/** Arabic pluralisation: جرعة / جرعتان / جرعات */
export function dosesWord(n: number): string {
  if (n === 1) return "جرعة واحدة";
  if (n === 2) return "جرعتان";
  if (n >= 3 && n <= 10) return `${n} جرعات`;
  return `${n} جرعة`;
}
