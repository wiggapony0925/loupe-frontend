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
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { useBiometrics } from "@/application/stores/biometricStore";
import { authenticateBiometric, getBiometricCapability } from "@/infrastructure/biometrics";
import { AuroraField } from "@/presentation/brand/AuroraField";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { FaceScan } from "@/presentation/features/auth/FaceScan";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export function BiometricLock() {
  const p = useThemedPalette();
  const { user, isAuthenticated, signOut } = useAuth();
  const deviceArmed = useBiometrics((s) => s.deviceArmed);
  const enabledBy = useBiometrics((s) => s.enabledBy);

  // The store rehydrates from AsyncStorage asynchronously, so `deviceArmed`
  // is false on the very first render even for someone who armed the lock.
  // Deciding then would leave the app open. Wait for hydration, THEN decide.
  const [hydrated, setHydrated] = useState(() => useBiometrics.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const done = useBiometrics.persist.onFinishHydration(() => setHydrated(true));
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setLocked(false);
      } else {
        // A cancel and a non-match look the same from here, and that is
        // fine: both mean "still locked, try when ready". No shake, no
        // scolding — the frame just goes rose for a beat.
        setFailed(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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
      {/* SafeAreaProvider again, INSIDE the modal. RN gives a Modal its own
          window and the app provider's insets do not cross into it, so without
          this the unlock button sits under the home indicator.

          `initialMetrics` is not optional here. A bare SafeAreaProvider renders
          NOTHING until it has measured, which on a lock screen means a frame of
          the app showing through before the lock paints — the one thing a lock
          must never do. initialWindowMetrics is captured at launch, so the
          first frame is already correct. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={[styles.root, { backgroundColor: p.bg.base }]}>
          {/* Same light as the sign-in screens — the lock is a door into
            Loupe, so it should look like one, not like an error page. */}
          <AuroraField variant="subtle" height={460} />
          <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
            <View style={styles.center}>
              {/* The user's own face, framed by the scanner. On a lock screen
              the avatar is the reassurance: it says WHOSE session this is
              before it asks anything of you. */}
              <FaceScan state={scanning ? "scanning" : failed ? "failed" : "idle"} size={148}>
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
              {/* Two lines, not one. "Welcome back, Jeffrey" set as a single
              29px string ran into both screen edges and broke wherever the
              name happened to fall — "Welcome back," on one line and a
              stranded first name on the next, different for every person.
              Splitting it puts the boilerplate in a quiet eyebrow and gives
              the name a line of its own, which is also the correct hierarchy:
              the greeting is furniture, the name is the reassurance that this
              is YOUR session. */}
              <View style={styles.greeting}>
                {name ? (
                  <>
                    <Text style={[styles.eyebrow, { color: p.ink.muted }]}>Welcome back</Text>
                    <Text
                      style={[styles.name, { color: p.ink.default }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {name}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.name, { color: p.ink.default }]}>Welcome back</Text>
                )}
              </View>

              {/* The cover says nothing — it exists so the app-switcher
              snapshot isn't someone's portfolio. */}
              {showCover ? null : (
                <View
                  style={[
                    styles.status,
                    {
                      borderColor: failed ? withAlpha(p.accent.rose, 0.35) : p.line.default,
                      backgroundColor: failed ? withAlpha(p.accent.rose, 0.1) : p.bg.elevated,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: failed
                          ? p.accent.rose
                          : scanning
                            ? p.accent.mint
                            : p.ink.muted,
                      },
                    ]}
                  />
                  <Text
                    style={[styles.statusText, { color: failed ? p.accent.rose : p.ink.muted }]}
                  >
                    {failed ? `${label} didn't confirm` : scanning ? "Looking…" : "Loupe is locked"}
                  </Text>
                </View>
              )}
            </View>

            {showCover ? null : (
              <View style={styles.actions}>
                {/* The same button component the sign-in form submits with, rather
                than a lookalike. This was a hand-rolled Pressable with its own
                radius, padding and gradient-free flat fill, so the first thing
                you touched each morning was subtly not the button you had used
                to sign in. */}
                <View style={styles.unlockWrap}>
                  <PrimaryButton
                    label={`Unlock with ${label}`}
                    icon={ScanFace}
                    onPress={() => void tryUnlock()}
                    loading={scanning}
                    variant="mint"
                    accessibilityLabel={`Unlock with ${label}`}
                  />
                </View>
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
                  <Text style={[styles.switch, { color: p.ink.muted }]}>Switch account</Text>
                </Pressable>
              </View>
            )}
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // A real column instead of a centred block with the buttons absolutely
  // pinned 64px off the bottom. The old arrangement laid the two out
  // independently: the greeting centred itself in the whole screen while the
  // actions sat at a magic offset that ignored the home indicator, so the gap
  // between them was different on every device and could collide on a small
  // one. `space-between` with a safe-area inset is what actually holds.
  safe: { flex: 1, paddingHorizontal: 28, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  greeting: { alignItems: "center", gap: 4, alignSelf: "stretch" },
  eyebrow: {
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  // Its own line, sized to the frame rather than the string. adjustsFontSizeToFit
  // handles the long-name case without the layout jumping.
  name: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 13.5, fontWeight: "600", letterSpacing: -0.1 },
  // In the flow now, not pinned. The safe-area inset below is what keeps it
  // clear of the home indicator, rather than a 64px guess.
  actions: { alignItems: "center", gap: 20, paddingBottom: 8 },
  unlockWrap: { alignSelf: "stretch" },
  switch: { fontSize: 14, fontWeight: "600" },
});
