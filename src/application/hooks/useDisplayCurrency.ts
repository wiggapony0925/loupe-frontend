/**
 * useDisplayCurrency — THE way to read & change the display currency.
 *
 * The selected code lives in two places on purpose:
 *   • the local `settingsStore` (instant, offline-safe, drives `useMoney()`)
 *   • the user's server profile (`PATCH /v1/me/settings { currency }`) so the
 *     choice follows them to the webapp and their other devices.
 *
 * `useCurrencyProfileSync()` closes the loop: mounted once at the root, it
 * adopts the server's saved currency into the local store whenever they
 * drift (sign-in on a new device, or a change made on the web).
 */
import { useCallback, useEffect } from "react";
import { useSettings } from "@/application/stores/settingsStore";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/application/queries/auth/useUserSettings";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { getCurrency } from "@/shared/currency";

export function useDisplayCurrency() {
  const currency = useSettings((s) => s.currency);
  const setLocal = useSettings((s) => s.setCurrency);
  const { isAuthenticated } = useAuth();
  const updateSettings = useUpdateUserSettings();

  const setCurrency = useCallback(
    (code: string) => {
      setLocal(code);
      // Persist to the profile so the webapp (and other devices) pick it up.
      // Fire-and-forget: the local store already updated, and the sync hook
      // reconciles if the write fails.
      if (isAuthenticated) {
        updateSettings.mutate({ currency: code });
      }
    },
    [setLocal, isAuthenticated, updateSettings],
  );

  return { currency, setCurrency };
}

/**
 * One-way server → local adoption. The local store is the render source of
 * truth (so money formatting never waits on the network); the profile is the
 * durable source of truth. Whenever the server reports a different saved
 * currency (fresh sign-in, webapp change), the local store follows it.
 *
 * Local changes don't bounce: `useDisplayCurrency.setCurrency` writes the
 * server cache optimistically, so by the time this effect re-runs the two
 * already agree.
 */
export function useCurrencyProfileSync(): void {
  const { data: serverSettings } = useUserSettings();
  const localCurrency = useSettings((s) => s.currency);
  const setLocal = useSettings((s) => s.setCurrency);

  useEffect(() => {
    const server = serverSettings?.currency;
    if (!server || server === localCurrency) return;
    // Only adopt codes the app's catalog can actually format.
    if (getCurrency(server).code !== server) return;
    setLocal(server);
  }, [serverSettings?.currency, localCurrency, setLocal]);
}
