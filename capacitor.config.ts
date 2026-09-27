import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Health Tracker — Android shell.
 * The WebView loads the deployed Vercel app (SERVER_URL) so the mobile app
 * always runs the latest code. For offline-first bundling later, switch to
 * `webDir` hosting (see docs/BUILD-MOBILE.md).
 */
const config: CapacitorConfig = {
  appId: "com.family.healthtracker",
  appName: "Health Tracker",
  webDir: "public",
  server: {
    // Live production app served in the WebView
    url: process.env.CAP_SERVER_URL ?? "https://health-tracker-git-main-mdsabrydev3g.vercel.app",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#1d6ff0",
      sound: "not.wav",
    },
  },
};

export default config;
