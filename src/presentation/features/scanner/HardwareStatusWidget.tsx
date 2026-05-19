import React from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Battery,
  Bluetooth,
  Camera,
  Cpu,
  Plug,
  ScanLine,
  Sparkles,
  Thermometer,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { GlassCard } from "@/presentation/components/GlassCard";
import { Badge } from "@/presentation/components/Badge";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { StatusDot } from "@/presentation/components/StatusDot";
import { Skeleton } from "@/presentation/components/Skeleton";
import { withAlpha, useThemedPalette } from "@/presentation/theme/tokens";
import { useScanner } from "./useScanner";
import { useScannerConnection } from "./useScannerConnection";

/**
 * Live hardware panel. Combines two data sources:
 *   - REST `/scanner/status` (transport, signal, scans remaining, temp)
 *   - Native bridge `scannerBridge` (battery, firmware, BLE connection)
 *
 * In Expo Go the bridge runs as a JS mock so the panel still renders
 * realistic data while the dev build isn't generated yet.
 */
export function HardwareStatusWidget() {
  const p = useThemedPalette();
  const { data, isLoading } = useScannerConnection();
  const scanner = useScanner();

  const TRANSPORT = {
    ble: { Icon: Bluetooth, label: "BLE", color: p.accent.blue },
    wifi: { Icon: Wifi, label: "Wi-Fi", color: p.accent.mint },
    offline: { Icon: WifiOff, label: "Offline", color: p.accent.rose },
  } as const;

  if (isLoading || data === undefined) {
    return (
      <GlassCard>
        <View className="flex-row items-center justify-between">
          <Skeleton width={110} height={10} radius={4} />
          <Skeleton width={64} height={20} radius={10} />
        </View>
        <View className="mt-4 flex-row items-center gap-4">
          <Skeleton width={48} height={48} radius={16} />
          <View className="flex-1 gap-2">
            <Skeleton width="55%" height={14} radius={4} />
            <Skeleton width="35%" height={10} radius={4} />
          </View>
        </View>
        <View className="mt-4 flex-row gap-3 border-t border-line pt-4">
          <Skeleton width="30%" height={28} radius={8} />
          <Skeleton width="30%" height={28} radius={8} />
          <Skeleton width="30%" height={28} radius={8} />
        </View>
      </GlassCard>
    );
  }

  // Backend explicitly returns `null` (not 404) when the signed-in user
  // has never paired a scanner. Render a richer empty state that sells
  // the hardware benefits and offers a phone-camera fallback so users
  // aren't dead-ended while their Loupe ships.
  if (data === null) {
    return (
      <GlassCard>
        <View className="flex-row items-center justify-between">
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Hardware Link
          </Text>
          <Badge label="Not paired" tone="neutral" />
        </View>

        <View className="mt-5 items-center">
          <View
            className="h-16 w-16 items-center justify-center rounded-3xl border border-line"
            style={{ backgroundColor: withAlpha(p.accent.blue, 0.08) }}
          >
            <Bluetooth size={26} color={p.accent.blue} />
          </View>
          <Text className="mt-3 text-center text-base font-semibold text-ink">
            No Loupe paired yet
          </Text>
          <Text className="mt-1 px-2 text-center text-xs leading-[18px] text-ink-muted">
            Pair your Loupe over Bluetooth for studio-grade photometric
            scans, automatic grading, and 4K macro capture.
          </Text>
        </View>

        <View className="mt-4 gap-2 border-t border-line pt-4">
          <FeatureRow
            Icon={Sparkles}
            label="AI grading"
            sub="PSA-level confidence on every scan"
            color={p.accent.mint}
          />
          <FeatureRow
            Icon={ScanLine}
            label="Edge-to-edge capture"
            sub="Centering, surface, and corners in one pass"
            color={p.accent.blue}
          />
        </View>

        <View className="mt-4 gap-2">
          <PrimaryButton
            label="Pair a Loupe"
            icon={Plug}
            onPress={() => router.push("/scan/pair")}
          />
          <Pressable
            onPress={() => router.push("/scan/phone")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scan with phone camera"
            className="flex-row items-center justify-center gap-2 py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Camera size={14} color={p.ink.muted} />
            <Text className="text-xs font-medium text-ink-muted">
              Use phone camera instead
            </Text>
          </Pressable>
        </View>
      </GlassCard>
    );
  }

  const meta = TRANSPORT[data.transport];
  const isOnline = data.transport !== "offline";
  const bleConnected = scanner.info?.connected ?? false;

  return (
    <GlassCard>
      <View className="flex-row items-center justify-between">
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          Hardware Link
        </Text>
        <View className="flex-row items-center gap-2">
          <Badge
            label={scanner.source === "native" ? "Native" : "Mock"}
            tone={scanner.source === "native" ? "mint" : "neutral"}
          />
          <Badge label={isOnline ? "Online" : "Disconnected"} tone={isOnline ? "mint" : "rose"} />
        </View>
      </View>

      <View className="mt-4 flex-row items-center gap-4">
        <View className="h-12 w-12 items-center justify-center rounded-2xl border border-line bg-bg-sunken">
          <meta.Icon size={22} color={meta.color} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-semibold text-ink">
              {scanner.info?.id ?? data.deviceName}
            </Text>
            <StatusDot color={meta.color} pulse={isOnline} size={8} />
          </View>
          <Text className="mt-0.5 text-xs text-ink-muted">
            {meta.label}
            {data.signalStrength != null
              ? ` · Signal ${Math.round(data.signalStrength * 100)}%`
              : ""}
            {" · FW "}
            {scanner.info?.firmware ?? data.firmware}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row gap-2 border-t border-line pt-4">
        <Metric
          Icon={Battery}
          label="Battery"
          value={scanner.info ? `${scanner.info.battery}%` : "—"}
        />
        <Metric
          Icon={Cpu}
          label="Scans Left"
          value={data.scansRemaining != null ? data.scansRemaining.toLocaleString() : "—"}
        />
        <Metric
          Icon={Thermometer}
          label="Sensor"
          value={data.temperatureC != null ? `${data.temperatureC.toFixed(1)}°C` : "—"}
        />
      </View>

      {!bleConnected ? (
        <View className="mt-3">
          <PrimaryButton
            label={scanner.stage === "connecting" ? "Connecting…" : "Connect scanner"}
            icon={Plug}
            variant="ghost"
            loading={scanner.stage === "connecting"}
            onPress={() => {
              scanner.connect(data.deviceName).catch(() => {});
            }}
          />
        </View>
      ) : null}

      {scanner.errorMessage ? (
        <Text className="mt-3 text-xs text-accent-rose">{scanner.errorMessage}</Text>
      ) : null}
    </GlassCard>
  );
}

function Metric({ Icon, label, value }: { Icon: typeof Cpu; label: string; value: string }) {
  const p = useThemedPalette();
  return (
    <View className="flex-1 flex-row items-center gap-2">
      <Icon size={14} color={p.ink.dim} />
      <View>
        <Text className="text-[10px] uppercase tracking-[2px] text-ink-dim">{label}</Text>
        <Text className="text-sm font-medium text-ink">{value}</Text>
      </View>
    </View>
  );
}

function FeatureRow({
  Icon,
  label,
  sub,
  color,
}: {
  Icon: typeof Sparkles;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className="h-8 w-8 items-center justify-center rounded-xl"
        style={{ backgroundColor: withAlpha(color, 0.12) }}
      >
        <Icon size={14} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{label}</Text>
        <Text className="text-[11px] text-ink-muted">{sub}</Text>
      </View>
    </View>
  );
}
