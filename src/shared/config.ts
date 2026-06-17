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
   * Hard-off. The app exclusively talks to the real backend. Kept for
   * back-compat with code paths still referencing the flag; new code
   * should not read it.
   */
  useMocks: false,
} as const;
