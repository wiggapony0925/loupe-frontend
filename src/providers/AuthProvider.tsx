/**
 * AuthProvider — token + user lifecycle.
 *
 * - Hydrates a saved JWT from AsyncStorage on mount, hands it to the API
 *   client, and fetches `/me` to populate `user`.
 * - Exposes `signInWithApple`/`signInWithGoogle` as stubs (real SDK wiring
 *   lives in a later round); shape is in place so screens can call them.
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
import type { MeResponse } from "@/api/types";

const TOKEN_STORAGE_KEY = "loupe.auth.token";

interface AuthContextValue {
  token: string | null;
  user: MeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
      signInWithApple,
      signInWithGoogle,
      signOut,
      setToken,
    }),
    [token, user, isLoading, signInWithApple, signInWithGoogle, signOut, setToken],
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
