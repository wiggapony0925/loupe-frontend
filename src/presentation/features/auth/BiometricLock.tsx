/**
 * BiometricLock — the Chase-style lock over the whole app.
 *
 * Rendered in a native MODAL, not a sibling View. RN puts each Modal in
 * its own window above the React root, so a plain overlay — however high
 * its zIndex — sits UNDER any BottomSheet that happened to be open when
 * the app was backgrounded. The lock has to be the last window presented
 * or it isn't a lock.
 *
 * Three states, deliberately distinct:
 *
 *   obscured  app went `inactive` (app switcher, Control Centre) → paint
 *             an opaque cover so the OS screenshot isn't your portfolio,
 *             and lift it on return with no Face ID. Demanding a face to
 *             check the time is how a lock becomes a thing people turn off.
 *   locked    app went `background`, or cold start with the lock armed →
 *             Face ID required.
 *   open      authenticated.
 *
 * Face ID fires when the lock is showing AND the app is actually active.
 * iOS refuses `evaluatePolicy` while backgrounded, and RN keeps running
 * JS for a moment after the app leaves, so an attempt fired on the
 * background transition silently fails — leaving a lock that never
 * prompts. It retries on every return to `active`.
 *
 * Whether to lock is a per-ACCOUNT question. `deviceArmed` is only the
 * cold-start stand-in for "we don't know who's signed in yet"; the moment
 * `/me` resolves, this account's own setting decides — otherwise the
 * roommate who never enabled Face ID gets locked behind YOUR face.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ScanFace } from "lucide-react-native";
import { useBiometrics } from "@/application/stores/biometricStore";
import {
  authenticateBiometric,
  getBiometricCapability,
} from "@/infrastructure/biometrics";
import { AuroraField } from "@/presentation/brand/AuroraField";
import { FaceScan } from "@/presentation/features/auth/FaceScan";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette } from "@/presentation/theme/tokens";

const ON_MINT = "#06140d";

export function BiometricLock() {
  const p = useThemedPalette();
  const { user, isAuthenticated, signOut } = useAuth();
  const deviceArmed = useBiometrics((s) => s.deviceArmed);
  const enabledBy = useBiometrics((s) => s.enabledBy);

  // The store rehydrates from AsyncStorage asynchronously, so `deviceArmed`
  // is false on the very first render even for someone who armed the lock.
  // Deciding then would leave the app open. Wait for hydration, THEN decide.
  const [hydrated, setHydrated] = useState(() =>
    useBiometrics.persist.hasHydrated(),
  );
  useEffect(() => {
    if (hydrated) return;
    const done = useBiometrics.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return done;
  }, [hydrated]);

  const [locked, setLocked] = useState(false);
  const [obscured, setObscured] = useState(false);
  const [active, setActive] = useState(true);
  const [label, setLabel] = useState("Face ID");
  const [scanning, setScanning] = useState(false);
  const [failed, setFailed] = useState(false);
  const attempting = useRef(false);

  const userId = user?.id ? String(user.id) : null;
  // null = we don't know yet (cold start, /me in flight) → fall back to the
  // device-wide mirror. Once known, this account's setting is the truth.
  const userEnabled = userId ? Boolean(enabledBy[userId]) : null;
  const shouldLock = userEnabled ?? deviceArmed;

  useEffect(() => {
    getBiometricCapability().then((cap) => setLabel(cap.label));
  }, []);

  // Cold start: lock as soon as we know the device is armed.
  useEffect(() => {
    if (hydrated && deviceArmed && isAuthenticated) setLocked(true);
  }, [hydrated, deviceArmed, isAuthenticated]);

  // Stand down: signed out, or /me resolved to an account without the lock.
  useEffect(() => {
    if (!isAuthenticated || userEnabled === false) setLocked(false);
  }, [isAuthenticated, userEnabled]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      setActive(next === "active");
      if (next === "active") {
        setObscured(false);
        return;
      }
      if (!isAuthenticated || !shouldLock) return;
      // `inactive` only covers the screenshot; `background` really locks.
      if (next === "inactive") setObscured(true);
      else if (next === "background") setLocked(true);
    });
    return () => sub.remove();
  }, [isAuthenticated, shouldLock]);

  const tryUnlock = useCallback(async () => {
    if (attempting.current) return;
    attempting.current = true;
    setScanning(true);
    setFailed(false);
    try {
      const ok = await authenticateBiometric("Unlock Loupe");
      if (ok) {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        setLocked(false);
      } else {
        // A cancel and a non-match look the same from here, and that is
        // fine: both mean "still locked, try when ready". No shake, no
        // scolding — the frame just goes rose for a beat.
        setFailed(true);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      }
    } finally {
      setScanning(false);
      attempting.current = false;
    }
  }, []);

  // Prompt whenever the lock is up and the app is genuinely frontmost —
  // including on every return from background, which is the common case.
  useEffect(() => {
    if (locked && isAuthenticated && active) void tryUnlock();
  }, [locked, isAuthenticated, active, tryUnlock]);

  const showCover = obscured && !locked && isAuthenticated && shouldLock;
  const visible = (locked && isAuthenticated) || showCover;
  if (!visible) return null;

  const name = user?.display_name ?? null;

  return (
    <Modal
      visible
      animationType="none"
      transparent={false}
      presentationStyle="fullScreen"
      // The lock is not dismissible; swallow Android back.
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View style={[styles.root, { backgroundColor: p.bg.base }]}>
        {/* Same light as the sign-in screens — the lock is a door into
            Loupe, so it should look like one, not like an error page. */}
        <AuroraField variant="subtle" height={460} />
        <View style={styles.center}>
          {/* The user's own face, framed by the scanner. On a lock screen
              the avatar is the reassurance: it says WHOSE session this is
              before it asks anything of you. */}
          <FaceScan
            state={scanning ? "scanning" : failed ? "failed" : "idle"}
            size={148}
          >
            {user ? (
              <SocialAvatar
                handle={user.email}
                name={user.display_name}
                url={user.avatar_url}
                size={74}
              />
            ) : (
              <ScanFace size={38} color={p.accent.mint} strokeWidth={1.8} />
            )}
          </FaceScan>
          <Text style={[styles.title, { color: p.ink.default }]}>
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </Text>
          {/* The cover says nothing — it exists so the app-switcher
              snapshot isn't someone's portfolio. */}
          {showCover ? null : (
            <Text style={[styles.subtitle, { color: p.ink.muted }]}>
              {failed
                ? `${label} didn't confirm — tap to try again`
                : scanning
                  ? "Looking…"
                  : "Loupe is locked"}
            </Text>
          )}
        </View>

        {showCover ? null : (
          <View style={styles.actions}>
            <Pressable
              onPress={() => void tryUnlock()}
              accessibilityRole="button"
              accessibilityLabel={`Unlock with ${label}`}
              style={({ pressed }) => [
                styles.unlock,
                { backgroundColor: p.accent.mint, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <ScanFace size={19} color={ON_MINT} strokeWidth={2.4} />
              <Text style={styles.unlockText}>Unlock with {label}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLocked(false);
                signOut();
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign out and use another account"
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[styles.switch, { color: p.ink.muted }]}>
                Switch account
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center", gap: 12 },
  title: {
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 18,
  },
  subtitle: { fontSize: 14.5 },
  actions: {
    position: "absolute",
    bottom: 64,
    left: 32,
    right: 32,
    alignItems: "center",
    gap: 22,
  },
  unlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    alignSelf: "stretch",
    borderRadius: 999,
    paddingVertical: 15,
  },
  unlockText: {
    color: ON_MINT,
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  switch: { fontSize: 14, fontWeight: "600" },
});
