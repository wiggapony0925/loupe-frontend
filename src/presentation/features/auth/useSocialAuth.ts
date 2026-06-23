import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { config } from "@/shared/config";

// Lets the in-app browser dismiss + hand the redirect back to JS on return.
WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = "apple" | "google";

export interface UseSocialAuthOptions {
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export interface SocialAuthState {
  /** Apple Sign In is iOS 13+ only. */
  appleAvailable: boolean;
  /** Google needs a configured iOS OAuth client id (else hidden, like web). */
  googleAvailable: boolean;
  /** Which provider's flow is in flight (drives per-button spinners). */
  busy: SocialProvider | null;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

/**
 * Reusable native social sign-in. Wraps the Apple + Google SDK flows and hands
 * the resulting identity / id token to {@link useAuth} for the backend
 * exchange — the same `/auth/apple` + `/auth/google` endpoints the web uses.
 * Each provider self-gates (Apple by OS support, Google by a configured client
 * id), so the buttons only appear where they can actually work.
 */
export function useSocialAuth(opts: UseSocialAuthOptions = {}): SocialAuthState {
  const { onSuccess, onError } = opts;
  const auth = useAuth();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleAvailable = !!config.googleIosClientId;

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

  // ── Google (expo-auth-session) ──
  const [, googleResponse, promptGoogle] = Google.useAuthRequest({
    iosClientId: config.googleIosClientId || undefined,
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const idToken =
        googleResponse.params?.id_token ?? googleResponse.authentication?.idToken;
      if (!idToken) {
        setBusy(null);
        onError?.("Google sign-in didn’t return a token. Please try again.");
        return;
      }
      auth
        .signInWithGoogle(idToken)
        .then(() => onSuccess?.())
        .catch(() => onError?.("Google sign-in failed. Please try again."))
        .finally(() => setBusy(null));
    } else {
      // error / dismiss / cancel — clear the spinner, stay quiet on cancel.
      setBusy(null);
      if (googleResponse.type === "error") {
        onError?.("Google sign-in failed. Please try again.");
      }
    }
    // auth/onSuccess/onError are stable enough; re-run only on a new response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const signInWithApple = useCallback(async () => {
    setBusy("apple");
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
      setBusy(null);
    }
  }, [auth, onSuccess, onError]);

  const signInWithGoogle = useCallback(async () => {
    setBusy("google");
    await promptGoogle(); // result lands in the googleResponse effect above
  }, [promptGoogle]);

  return {
    appleAvailable,
    googleAvailable,
    busy,
    signInWithApple,
    signInWithGoogle,
  };
}
