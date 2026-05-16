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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError, apiFetch, setAuthToken } from "@/api/client";
import { ENDPOINTS } from "@/api/endpoints";
import {
  devLogin as devLoginApi,
  loginWithEmail as loginWithEmailApi,
  registerWithEmail as registerWithEmailApi,
} from "@/api/auth";
import type { MeResponse } from "@/api/types";

const TOKEN_STORAGE_KEY = "loupe.auth.token";

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistToken = useCallback(async (next: string | null) => {
    setTokenState(next);
    setAuthToken(next);
    try {
      if (next) await AsyncStorage.setItem(TOKEN_STORAGE_KEY, next);
      else await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      /* storage unavailable in some test envs — non-fatal */
    }
  }, []);

  // Hydrate token + user on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY).catch(
          () => null,
        );
        if (cancelled) return;
        if (stored) {
          setAuthToken(stored);
          setTokenState(stored);
          try {
            const me = await apiFetch<MeResponse>(ENDPOINTS.me.root);
            if (!cancelled) setUser(me);
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
              // Token expired/revoked → drop it.
              await persistToken(null);
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
  }, [persistToken]);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const pair = await registerWithEmailApi({
        email: email.trim().toLowerCase(),
        password,
        display_name: displayName?.trim() || null,
      });
      await persistToken(pair.access_token);
      setUser(pair.user);
    },
    [persistToken],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const pair = await loginWithEmailApi({
        email: email.trim().toLowerCase(),
        password,
      });
      await persistToken(pair.access_token);
      setUser(pair.user);
    },
    [persistToken],
  );

  const signInWithDevLogin = useCallback(
    async (email: string, displayName?: string) => {
      const pair = await devLoginApi({
        email: email.trim().toLowerCase(),
        display_name: displayName?.trim() || null,
      });
      await persistToken(pair.access_token);
      setUser(pair.user);
    },
    [persistToken],
  );

  const signOut = useCallback(() => {
    void persistToken(null);
    setUser(null);
  }, [persistToken]);

  const signInWithApple = useCallback(async () => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[auth] signInWithApple: not yet wired");
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("[auth] signInWithGoogle: not yet wired");
    }
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
