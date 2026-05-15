import React from "react";
import { Text, View } from "react-native";
import { Battery, Bluetooth, Cpu, Plug, Thermometer, Wifi, WifiOff } from "lucide-react-native";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StatusDot } from "@/components/ui/StatusDot";
import { Skeleton } from "@/components/ui/Skeleton";
import { useThemedPalette } from "@/theme/tokens";
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

  if (isLoading || !data) {
    return (
      <GlassCard>
        <Skeleton width={160} height={12} />
        <View className="mt-4 flex-row items-center gap-3">
          <Skeleton width={40} height={40} radius={20} />
          <View className="flex-1 gap-2">
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={10} />
          </View>
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
            {meta.label} · Signal {Math.round(data.signalStrength * 100)}% · FW{" "}
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
        <Metric Icon={Cpu} label="Scans Left" value={data.scansRemaining.toLocaleString()} />
        <Metric Icon={Thermometer} label="Sensor" value={`${data.temperatureC.toFixed(1)}°C`} />
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
