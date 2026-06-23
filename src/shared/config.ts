/**
 * Runtime config for the Loupe client.
 *
 * Set these via Expo public env vars in `.env` (loaded automatically by Expo):
 *   EXPO_PUBLIC_API_URL=https://api.loupe.app
 *   EXPO_PUBLIC_WS_URL=wss://api.loupe.app
 */

const env = (process.env ?? {}) as Record<string, string | undefined>;

export const config = {
  apiUrl: env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000",
  wsUrl:
    env.EXPO_PUBLIC_WS_URL ??
    (env.EXPO_PUBLIC_API_URL
      ? env.EXPO_PUBLIC_API_URL.replace(/^http/, "ws")
      : "ws://localhost:8000"),
  /**
   * Web app origin — where the React developer portal lives. The mobile app
   * embeds `${webUrl}/admin` in a WebView for admins. Defaults to the live
   * Cloud Run service (the `loupe.app` custom domain isn't wired to DNS yet, so
   * defaulting to it produced "cannot find host" -1003 in the WebView). Once a
   * custom domain is mapped to the loupe-web service, set EXPO_PUBLIC_WEB_URL
   * (or update this default) to it.
   */
  webUrl:
    env.EXPO_PUBLIC_WEB_URL ??
    "https://loupe-web-714615078104.us-central1.run.app",
  /**
   * Hard-off. The app exclusively talks to the real backend. Kept for
   * back-compat with code paths still referencing the flag; new code
   * should not read it.
   */
  useMocks: false,
} as const;
