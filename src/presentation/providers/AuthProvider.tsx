/**
 * AuthProvider — token + user lifecycle.
 *
 * - Hydrates a saved JWT from AsyncStorage on mount, hands it to the API
 *   client, and fetches `/me` to populate `user`.
 * - Exposes email/password sign-up + sign-in and a dev-login helper.
 *   `signInWithApple`/`signInWithGoogle` remain stubs until the native
 *   SDKs are wired.
 * - Persists every token change so the app survives cold boots.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ApiError,
  apiFetch,
  setAuthToken,
  setRefreshHandler,
} from "@/infrastructure/http/client";
import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import { queryClient } from "@/application/queries/queryClient";
import {
  devLogin as devLoginApi,
  loginWithEmail as loginWithEmailApi,
  registerWithEmail as registerWithEmailApi,
  refreshSession as refreshSessionApi,
} from "@/infrastructure/repositories/authRepository";
import {
  TOKEN_KEY as TOKEN_STORAGE_KEY,
  REFRESH_KEY as REFRESH_STORAGE_KEY,
  getSecureItem,
  setSecureItem,
  deleteSecureItem,
} from "@/infrastructure/storage/secureTokenStore";
import type { MeResponse } from "@/infrastructure/http";

interface AuthContextValue {
  token: string | null;
  user: MeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithDevLogin: (email: string, displayName?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => void;
  setToken: (token: string | null) => void;
  /**
   * Proactively rotate the access token using the stored refresh
   * token. Safe to call on app foreground / cold open so the next
   * authenticated request doesn't burn a 401 → /auth/refresh round
   * trip on a freshly-warm Cloud Run container. No-ops (returns the
   * current token) when no refresh token is available or when the
   * exchange fails (failure path also signs the user out).
   */
  refreshNow: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Held in a ref so the refresh handler (registered once on mount) can
  // always read the latest token without re-registering on every change.
  const refreshTokenRef = React.useRef<string | null>(null);

  const persistTokens = useCallback(
    async (next: { access: string; refresh: string | null } | null) => {
      // Any cached query data belongs to the previous user — wipe it so the
      // next account doesn't see stale portfolio totals, vault rows, etc.
      // (Only on full sign-out / account switch — a silent refresh keeps
      // the same user, so we leave the cache alone.)
      const isFullSwap = next === null;
      if (isFullSwap) queryClient.clear();
      const nextAccess = next?.access ?? null;
      const nextRefresh = next?.refresh ?? null;
      setTokenState(nextAccess);
      setAuthToken(nextAccess);
      refreshTokenRef.current = nextRefresh;
      if (nextAccess) await setSecureItem(TOKEN_STORAGE_KEY, nextAccess);
      else await deleteSecureItem(TOKEN_STORAGE_KEY);
      if (nextRefresh) await setSecureItem(REFRESH_STORAGE_KEY, nextRefresh);
      else await deleteSecureItem(REFRESH_STORAGE_KEY);
    },
    [],
  );

  // Back-compat for call sites that still pass a bare token string.
  const persistToken = useCallback(
    async (next: string | null) => {
      if (next === null) {
        await persistTokens(null);
      } else {
        await persistTokens({ access: next, refresh: refreshTokenRef.current });
      }
    },
    [persistTokens],
  );

  // Single implementation shared between the 401-handler path and the
  // proactive foreground-refresh path (`refreshNow`). De-duped with a
  // module-level promise so multiple callers triggering at the same
  // moment (e.g. AppState foreground + an in-flight 401) collapse to a
  // single network call.
  const inflightRefresh = React.useRef<Promise<string | null> | null>(null);
  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (inflightRefresh.current) return inflightRefresh.current;
    const rt = refreshTokenRef.current;
    if (!rt) return null;
    const job = (async () => {
      try {
        const pair = await refreshSessionApi({ refresh_token: rt });
        setTokenState(pair.access_token);
        setAuthToken(pair.access_token);
        refreshTokenRef.current = pair.refresh_token;
        await setSecureItem(TOKEN_STORAGE_KEY, pair.access_token);
        await setSecureItem(REFRESH_STORAGE_KEY, pair.refresh_token);
        if (pair.user) setUser(pair.user);
        return pair.access_token;
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("[auth] refresh failed, signing out:", String(err));
        }
        await persistTokens(null);
        setUser(null);
        return null;
      } finally {
        inflightRefresh.current = null;
      }
    })();
    inflightRefresh.current = job;
    return job;
  }, [persistTokens]);

  // Register the refresh-on-401 handler exactly once. The client module
  // will call this whenever an authenticated request comes back 401.
  useEffect(() => {
    setRefreshHandler(doRefresh);
    return () => {
      setRefreshHandler(null);
    };
  }, [doRefresh]);

  // Hydrate token + user on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stored, storedRefresh] = await Promise.all([
          getSecureItem(TOKEN_STORAGE_KEY),
          getSecureItem(REFRESH_STORAGE_KEY),
        ]);
        if (cancelled) return;
        if (stored) {
          setAuthToken(stored);
          setTokenState(stored);
          refreshTokenRef.current = storedRefresh;
          try {
            const me = await apiFetch<MeResponse>(ENDPOINTS.me.root);
            if (!cancelled) setUser(me);
          } catch (err) {
            // 401 here means hydrated access token is expired AND the
            // refresh handler (registered above) couldn't trade the
            // refresh token for a new pair. Drop everything.
            if (err instanceof ApiError && err.status === 401) {
              await persistTokens(null);
              if (!cancelled) setUser(null);
            }
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistTokens]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const pair = await registerWithEmailApi({
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName?.trim() || null,
      });
      await persistTokens({ access: pair.access_token, refresh: pair.refresh_token });
      setUser(pair.user);
    },
    [persistTokens],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const pair = await loginWithEmailApi({
        email: email.trim().toLowerCase(),
        password,
      });
      await persistTokens({ access: pair.access_token, refresh: pair.refresh_token });
      setUser(pair.user);
    },
    [persistTokens],
  );

  const signInWithDevLogin = useCallback(
    async (email: string, displayName?: string) => {
      const pair = await devLoginApi({
        email: email.trim().toLowerCase(),
        display_name: displayName?.trim() || null,
      });
      await persistTokens({ access: pair.access_token, refresh: pair.refresh_token });
      setUser(pair.user);
    },
    [persistTokens],
  );

  const signOut = useCallback(() => {
    void persistTokens(null);
    setUser(null);
  }, [persistTokens]);

  const signInWithApple = useCallback(async () => {
    // Fail loudly so QA / call sites notice unwired buttons in any env.
    throw new Error("signInWithApple is not implemented yet");
  }, []);

  const signInWithGoogle = useCallback(async () => {
    throw new Error("signInWithGoogle is not implemented yet");
  }, []);

  const setToken = useCallback(
    (next: string | null) => {
      void persistToken(next);
    },
    [persistToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: !!token,
      isLoading,
      signUpWithEmail,
      signInWithEmail,
      signInWithDevLogin,
      signInWithApple,
      signInWithGoogle,
      signOut,
      setToken,
      refreshNow: doRefresh,
    }),
    [
      token,
      user,
      isLoading,
      signUpWithEmail,
      signInWithEmail,
      signInWithDevLogin,
      signInWithApple,
      signInWithGoogle,
      signOut,
      setToken,
      doRefresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
