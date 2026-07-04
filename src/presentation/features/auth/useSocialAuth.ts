import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/presentation/providers/AuthProvider";

// Lets the in-app browser dismiss + hand the redirect back to JS on return.
WebBrowser.maybeCompleteAuthSession();

export interface UseSocialAuthOptions {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export interface SocialAuthState {
  /** Apple Sign In is iOS 13+ only. */
  appleAvailable: boolean;
  /** The Apple flow is in flight (drives the button spinner). */
  busy: boolean;
  signInWithApple: () => Promise<void>;
}

/**
 * Apple sign-in flow, shared by the Sign In + Sign Up screens. Hands the
 * identity token to {@link useAuth} for the backend exchange — the same
 * `/auth/apple` endpoint the web uses.
 *
 * Google deliberately does NOT live here: its `Google.useAuthRequest` hook
 * throws during render when no client id is configured, so it's isolated in
 * `GoogleSignInButton`, which callers render only when configured. Keeping it
 * out of this always-mounted hook is what keeps the auth screens crash-proof
 * when the build is missing `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
 */
export function useSocialAuth(opts: UseSocialAuthOptions = {}): SocialAuthState {
  const { onSuccess, onError } = opts;
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then((ok) => alive && setAppleAvailable(ok))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, []);

  const signInWithApple = useCallback(async () => {
    setBusy(true);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error("no-token");
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName]
        .filter(Boolean)
        .join(" ")
        .trim();
      await auth.signInWithApple(cred.identityToken, fullName || undefined);
      onSuccess?.();
    } catch (e) {
      // Tapping "Cancel" in the Apple sheet throws ERR_REQUEST_CANCELED — quiet.
      const code = (e as { code?: string })?.code;
      if (code !== "ERR_REQUEST_CANCELED" && code !== "ERR_CANCELED") {
        onError?.("Apple sign-in failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }, [auth, onSuccess, onError]);

  return { appleAvailable, busy, signInWithApple };
}
