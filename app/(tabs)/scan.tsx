/**
 * `(tabs)/scan` — center-pinned Scan tab.
 *
 * The single most important verb in the app is scanning a card. Under
 * the old IA it was a section near the bottom of Command Center and a
 * sub-step inside a hardware pairing flow — meaning the primary action
 * could cost two-plus taps from any non-home tab. Promoting it to the
 * middle tab slot (Robinhood/Cash App pattern) makes capture a global
 * one-tap surface.
 *
 * The screen itself is a landing card that mirrors the Studio/Quick
 * toggle from `PhoneCaptureCard` on home, then pushes into the existing
 * `/scan/phone` modal so the capture pipeline (`PhoneCaptureFlow` →
 * `CaptureReviewScreen` → `useScanJob`) stays unchanged.
 *
 * The slot freed up by removing the Watch tab — Watch is a management
 * screen for a feature most users won't configure, and it now lives
 * behind the bell where it belongs.
 */
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Gauge,
  Layers,
  PlusCircle,
  Smartphone,
  Sparkles,
  Zap,
} from "lucide-react-native";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { SectionHeader } from "@/presentation/components/SectionHeader";
import { useScannerConnection } from "@/presentation/features/scanner";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { routes } from "@/shared/routes";

/**
 * Scan tab — the single most important verb in the app, with ONE clear job:
 * point the camera at a card and identify it. What happens next (see price,
 * add to vault, or grade it) is decided AFTER we recognise the card, on the
 * result sheet — not as an up-front "Studio vs Quick" mode choice the user
 * had to make before they'd even seen anything. Grading lives one tap away as
 * its own deliberate path for when that's the actual intent.
 */
export default function ScanTabScreen() {
  const p = useThemedPalette();
  const hardware = useScannerConnection();
  const connected =
    hardware.data != null && hardware.data.transport !== "offline";

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Capture · primary
          </Text>
          <Text className="mt-1 text-[28px] font-bold tracking-tight text-ink">
            Scan a card
          </Text>
          <Text className="mt-1 text-[13px] text-ink-muted">
            Point your camera at a card — we identify it and show the price.
            Then add it to your vault or grade it.
          </Text>
        </View>

        {/* The one primary action: live identify. The result sheet branches
            into price / vault / grade once a card is recognised. */}
        <PrimaryButton
          label="Scan a card"
          icon={Zap}
          onPress={() => router.push(routes.scanIdentify())}
          variant="mint"
          accessibilityLabel="Open the live card scanner"
        />

        {/* Deliberate secondary paths — grade (its own verb), add a card you
            already know, or use the hardware scanner. One tap, not a menu. */}
        <View>
          <SectionHeader eyebrow="Or" title="Grade & add" />
          <View style={{ gap: 10 }}>
            <SecondaryRow
              icon={Gauge}
              tint={p.accent.purple}
              label="Grade a card"
              detail="Measure centering, edges & surface — estimate the grade before you slab."
              onPress={() => router.push(routes.scanPhone("studio"))}
            />
            <SecondaryRow
              icon={PlusCircle}
              tint={p.accent.amber}
              label="Add by catalog"
              detail="Already know the card? Pick it and enter cost basis."
              onPress={() => router.push(routes.gradeNew())}
            />
            <SecondaryRow
              icon={Smartphone}
              tint={connected ? p.accent.mint : p.ink.muted}
              label={connected ? "Hardware scanner ready" : "Pair Loupe scanner"}
              detail={
                connected
                  ? "Open the desktop app to capture from the cradle."
                  : "Connect the Bluetooth scanner for studio-grade results."
              }
              onPress={() => router.push("/scan/pair")}
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(p.accent.mint, 0.25),
            backgroundColor: withAlpha(p.accent.mint, 0.06),
          }}
        >
          <Sparkles size={16} color={p.accent.mint} />
          <Text
            style={{ color: p.ink.muted, fontSize: 12, flex: 1, lineHeight: 17 }}
          >
            Every scan trains your portfolio — identify once, track value forever.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SecondaryRowProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tint: string;
  label: string;
  detail: string;
  onPress: () => void;
}

function SecondaryRow({ icon: Icon, tint, label, detail, onPress }: SecondaryRowProps) {
  const p = useThemedPalette();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: withAlpha(tint, 0.14),
        }}
      >
        <Icon size={18} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "600" }}>
          {label}
        </Text>
        <Text style={{ color: p.ink.muted, fontSize: 12, marginTop: 2 }}>
          {detail}
        </Text>
      </View>
      <Layers size={14} color={p.ink.dim} />
    </Pressable>
  );
}
