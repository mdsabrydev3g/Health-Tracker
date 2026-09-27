"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * Dose reminders.
 * - On Android (Capacitor shell): exact local notifications scheduled ahead of
 *   time from today's materialised doses — they fire even when the app is closed.
 * - On web: best-effort Notification API for the currently open tab.
 */

interface DoseLite {
  id: string;
  medicationName: string;
  scheduledAtUtc: string;
  status: string;
}

export async function scheduleDoseReminders(doses: DoseLite[]) {
  const upcoming = doses.filter(
    (d) => ["upcoming", "due", "snoozed"].includes(d.status) && new Date(d.scheduledAtUtc) > new Date(),
  );

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return;

      await LocalNotifications.createChannel({
        id: "dose-reminders",
        name: "تذكير الجرعات",
        importance: 5, // HIGH
        sound: "not.wav",
        vibration: true,
      });

      const pending = await LocalNotifications.getPending();
      const mine = pending.notifications.filter((n) => n.extra?.kind === "dose");
      if (mine.length) {
        await LocalNotifications.cancel({ notifications: mine.map((n) => ({ id: n.id })) });
      }

      if (upcoming.length) {
        await LocalNotifications.schedule({
          notifications: upcoming.slice(0, 20).map((d, i) => ({
            id: 10_000 + i,
            title: `حان موعد جرعة ${d.medicationName}`,
            body: "افتح التطبيق واضغط «أخذت الدواء»",
            schedule: { at: new Date(d.scheduledAtUtc), allowWhileIdle: true },
            channelId: "dose-reminders",
            extra: { kind: "dose", doseId: d.id },
          })),
        });
      }
    } catch {
      // never break the UI on notification failure
    }
  } else if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    const next = upcoming[0];
    if (next && new Date(next.scheduledAtUtc).getTime() - Date.now() < 60_000) {
      new Notification(`حان موعد جرعة ${next.medicationName}`, {
        body: "افتح التطبيق واضغط «أخذت الدواء»",
        lang: "ar",
        dir: "rtl",
      });
    }
  }
}

export async function registerServiceWorker() {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    if (!Capacitor.isNativePlatform()) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }
}
