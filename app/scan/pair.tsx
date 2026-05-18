/**
 * Pair-a-Loupe flow.
 *
 * Four-step onboarding inspired by Robinhood's account-link sheets and
 * Alexa's device-setup wizard: each step owns exactly one decision and
 * one CTA, so the user is never staring at a form.
 *
 *   1. welcome   — what we're about to do + "Get started"
 *   2. prepare   — power on / pair-mode instructions + "I'm ready"
 *   3. searching — animated BLE radar; calls scanner.connect() and on
 *                  success POSTs /v1/scanners then advances
 *   4. success   — connected device summary + "Start scanning" CTA
 *
 * The flow is fully self-contained: it does not assume a particular
 * entry route, so any "Pair a Loupe" CTA in the app (Command Center
 * empty state, Settings, onboarding) can `router.push("/scan/pair")`.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Battery,
  Bluetooth,
  Check,
  Power,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react-native";
import { GlassCard } from "@/components/ui/GlassCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useThemedPalette, withAlpha } from "@/theme/tokens";
import { useScanner } from "@/features/scanner/useScanner";
import { pairScanner } from "@/api/forensicApi";

type Stage = "welcome" | "prepare" | "searching" | "success" | "error";

export default function PairScannerScreen() {
  const p = useThemedPalette();
  const qc = useQueryClient();
  const scanner = useScanner();
  const [stage, setStage] = useState<Stage>("welcome");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startPairing = useCallback(async () => {
    setStage("searching");
    setErrorMessage(null);
    try {
      // The native bridge handles discovery internally and resolves with
      // the first advertising Loupe. In Expo Go the mock bridge resolves
      // immediately with a fake device so the flow stays demoable.
      const info = await scanner.connect();
      await pairScanner({
        deviceId: info.id,
        name: info.id,
        firmwareVersion: info.firmware,
        transport: "ble",
      });
      // Refresh the Command Center widget so the new device shows up
      // the moment the user lands back on home.
      await qc.invalidateQueries({ queryKey: ["hardware-status"] });
      setStage("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "We couldn't reach the scanner.";
      setErrorMessage(message);
      setStage("error");
    }
  }, [scanner, qc]);

  const handleDone = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
        <Pressable
          accessibilityLabel="Close pairing"
          hitSlop={12}
          onPress={handleDone}
          className="h-10 w-10 items-center justify-center rounded-full"
        >
          <X size={22} color={p.ink.dim} />
        </Pressable>
        <StepDots stage={stage} />
        <View className="h-10 w-10" />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {stage === "welcome" ? (
          <WelcomeStep onContinue={() => setStage("prepare")} />
        ) : null}
        {stage === "prepare" ? (
          <PrepareStep onContinue={startPairing} />
        ) : null}
        {stage === "searching" ? <SearchingStep /> : null}
        {stage === "success" ? (
          <SuccessStep
            deviceName={scanner.info?.id ?? "Your Loupe"}
            firmware={scanner.info?.firmware ?? "—"}
            battery={scanner.info?.battery ?? null}
            onDone={handleDone}
          />
        ) : null}
        {stage === "error" ? (
          <ErrorStep
            message={errorMessage ?? "Pairing failed."}
            onRetry={startPairing}
            onCancel={handleDone}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Steps ──────────────────────────────────────────────────────────── */

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  const p = useThemedPalette();
  return (
    <View className="flex-1 justify-between py-6">
      <View>
        <HeroIcon Icon={Bluetooth} tint={p.accent.blue} />
        <Text className="mt-8 text-3xl font-semibold text-ink">
          Pair your Loupe
        </Text>
        <Text className="mt-3 text-base leading-6 text-ink-muted">
          We&apos;ll connect to your Loupe scanner over Bluetooth so you can
          capture studio-grade photometric scans straight from your phone.
        </Text>

        <View className="mt-8 gap-3">
          <Bullet
            Icon={Zap}
            title="Takes about 30 seconds"
            body="No accounts, no codes — just hold the device near your phone."
          />
          <Bullet
            Icon={Sparkles}
            title="Unlocks full-grade scans"
            body="Phone-only scans will still work, but pairing turns on the 4-light photometric pipeline."
          />
        </View>
      </View>

      <View className="pt-8">
        <PrimaryButton label="Get started" icon={ArrowRight} onPress={onContinue} />
      </View>
    </View>
  );
}

function PrepareStep({ onContinue }: { onContinue: () => void }) {
  const p = useThemedPalette();
  return (
    <View className="flex-1 justify-between py-6">
      <View>
        <HeroIcon Icon={Power} tint={p.accent.mint} />
        <Text className="mt-8 text-3xl font-semibold text-ink">
          Turn on your Loupe
        </Text>
        <Text className="mt-3 text-base leading-6 text-ink-muted">
          Hold the side button for about three seconds. You&apos;ll see the
          ring light pulse blue when it&apos;s ready to pair.
        </Text>

        <View className="mt-8 gap-3">
          <NumberStep n={1} text="Place the Loupe within arm's reach of your phone." />
          <NumberStep n={2} text="Hold the side button until the ring pulses blue." />
          <NumberStep n={3} text="Make sure Bluetooth is on — we'll do the rest." />
        </View>
      </View>

      <View className="pt-8">
        <PrimaryButton label="I'm ready" icon={ArrowRight} onPress={onContinue} />
      </View>
    </View>
  );
}

function SearchingStep() {
  const p = useThemedPalette();
  return (
    <View className="flex-1 items-center justify-center py-6">
      <Radar tint={p.accent.blue} />
      <Text className="mt-10 text-2xl font-semibold text-ink">
        Looking for your Loupe…
      </Text>
      <Text className="mt-3 px-6 text-center text-base leading-6 text-ink-muted">
        Keep the device within a couple of feet. We&apos;ll connect as
        soon as it advertises.
      </Text>
    </View>
  );
}

function SuccessStep({
  deviceName,
  firmware,
  battery,
  onDone,
}: {
  deviceName: string;
  firmware: string;
  battery: number | null;
  onDone: () => void;
}) {
  const p = useThemedPalette();
  return (
    <View className="flex-1 justify-between py-6">
      <View>
        <HeroIcon Icon={Check} tint={p.accent.mint} />
        <Text className="mt-8 text-3xl font-semibold text-ink">
          You&apos;re paired
        </Text>
        <Text className="mt-3 text-base leading-6 text-ink-muted">
          {deviceName} is connected and ready. We&apos;ve linked it to your
          Loupe account so it&apos;ll auto-reconnect next time.
        </Text>

        <GlassCard className="mt-8">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-2xl border border-line bg-bg-sunken">
              <Bluetooth size={18} color={p.accent.blue} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink">{deviceName}</Text>
              <Text className="mt-0.5 text-xs text-ink-muted">FW {firmware}</Text>
            </View>
            {battery != null ? (
              <View className="flex-row items-center gap-1">
                <Battery size={14} color={p.ink.dim} />
                <Text className="text-sm font-medium text-ink">{battery}%</Text>
              </View>
            ) : null}
          </View>
        </GlassCard>
      </View>

      <View className="gap-2 pt-8">
        <PrimaryButton label="Start scanning" icon={Search} onPress={onDone} />
      </View>
    </View>
  );
}

function ErrorStep({
  message,
  onRetry,
  onCancel,
}: {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const p = useThemedPalette();
  return (
    <View className="flex-1 justify-between py-6">
      <View>
        <HeroIcon Icon={AlertTriangle} tint={p.accent.rose} />
        <Text className="mt-8 text-3xl font-semibold text-ink">
          We couldn&apos;t connect
        </Text>
        <Text className="mt-3 text-base leading-6 text-ink-muted">{message}</Text>

        <View className="mt-8 gap-3">
          <Bullet
            Icon={Bluetooth}
            title="Bluetooth on?"
            body="Open Settings → Bluetooth and make sure it's enabled for Loupe."
          />
          <Bullet
            Icon={Power}
            title="Loupe in pair mode?"
            body="Hold the side button again until the ring pulses blue."
          />
        </View>
      </View>

      <View className="gap-2 pt-8">
        <PrimaryButton label="Try again" icon={ArrowRight} onPress={onRetry} />
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          className="h-12 items-center justify-center"
        >
          <Text className="text-sm font-medium text-ink-muted">Maybe later</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Bits ───────────────────────────────────────────────────────────── */

function HeroIcon({
  Icon,
  tint,
}: {
  Icon: typeof Bluetooth;
  tint: string;
}) {
  const p = useThemedPalette();
  return (
    <View
      className="h-20 w-20 items-center justify-center rounded-3xl"
      style={{
        backgroundColor: withAlpha(tint, 0.12),
        borderWidth: 1,
        borderColor: withAlpha(tint, 0.2),
      }}
    >
      <Icon size={36} color={tint} />
    </View>
  );
}

function Bullet({
  Icon,
  title,
  body,
}: {
  Icon: typeof Zap;
  title: string;
  body: string;
}) {
  const p = useThemedPalette();
  return (
    <View className="flex-row items-start gap-3">
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-2xl border border-line bg-bg-sunken">
        <Icon size={16} color={p.ink.dim} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{title}</Text>
        <Text className="mt-0.5 text-xs leading-5 text-ink-muted">{body}</Text>
      </View>
    </View>
  );
}

function NumberStep({ n, text }: { n: number; text: string }) {
  const p = useThemedPalette();
  return (
    <View className="flex-row items-start gap-3">
      <View
        className="mt-0.5 h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: withAlpha(p.accent.mint, 0.15) }}
      >
        <Text className="text-sm font-semibold" style={{ color: p.accent.mint }}>
          {n}
        </Text>
      </View>
      <Text className="flex-1 pt-1 text-sm leading-5 text-ink">{text}</Text>
    </View>
  );
}

function StepDots({ stage }: { stage: Stage }) {
  const p = useThemedPalette();
  const order: Stage[] = ["welcome", "prepare", "searching", "success"];
  // The "error" stage shares the searching dot — we don't penalise the
  // user visually for a recoverable failure.
  const activeIdx = stage === "error" ? 2 : order.indexOf(stage);
  return (
    <View className="flex-row items-center gap-1.5">
      {order.map((_, i) => (
        <View
          key={i}
          className="h-1.5 rounded-full"
          style={{
            width: i === activeIdx ? 18 : 6,
            backgroundColor: i <= activeIdx ? p.ink.default : p.line.default,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Pulsing concentric-ring animation used during the BLE scan. Lightweight
 * (only Animated values, no SVG) so it runs smoothly during the bridge's
 * native discovery work.
 */
function Radar({ tint }: { tint: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
    const la = loop(a, 0);
    const lb = loop(b, 900);
    la.start();
    lb.start();
    return () => {
      la.stop();
      lb.stop();
    };
  }, [a, b]);

  const ring = (v: Animated.Value) => ({
    transform: [
      {
        scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.4] }),
      },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
  });

  return (
    <View className="h-44 w-44 items-center justify-center">
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            height: 176,
            width: 176,
            borderRadius: 88,
            backgroundColor: withAlpha(tint, 0.25),
          },
          ring(a),
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            height: 176,
            width: 176,
            borderRadius: 88,
            backgroundColor: withAlpha(tint, 0.25),
          },
          ring(b),
        ]}
      />
      <View
        className="h-20 w-20 items-center justify-center rounded-full"
        style={{
          backgroundColor: withAlpha(tint, 0.18),
          borderWidth: 1,
          borderColor: withAlpha(tint, 0.35),
        }}
      >
        <Bluetooth size={32} color={tint} />
      </View>
    </View>
  );
}
