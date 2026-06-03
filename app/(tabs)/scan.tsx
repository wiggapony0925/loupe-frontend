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
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Camera,
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

type Mode = "studio" | "quick";

export default function ScanTabScreen() {
  const p = useThemedPalette();
  const [mode, setMode] = useState<Mode>("studio");
  const hardware = useScannerConnection();
  const connected =
    hardware.data != null && hardware.data.transport !== "offline";
  const isStudio = mode === "studio";
  const tint = isStudio ? p.accent.mint : p.accent.blue;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: p.bg.base }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Eyebrow + page title — sets the tab's identity without a
            bulky chrome header. Matches the cadence of Vault/Search. */}
        <View>
          <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Capture · primary
          </Text>
          <Text className="mt-1 text-[28px] font-bold tracking-tight text-ink">
            Scan a card
          </Text>
          <Text className="mt-1 text-[13px] text-ink-muted">
            Pick a capture mode, then we'll guide you frame-by-frame.
          </Text>
        </View>

        {/* Mode toggle — same Studio/Quick semantics as the home card
            so the muscle memory transfers. Quick now routes to the
            live-identify viewfinder (TCGplayer / Collectr-style),
            which is the same surface the standalone hero used to
            push — we collapsed the duplicate. */}
        <View style={{ gap: 12 }}>
          <ModeCard
            label="Studio"
            tagline="Grade & add to vault"
            detail="4-shot photometric capture — ±0.5 of certified."
            tint={p.accent.mint}
            active={isStudio}
            onPress={() => setMode("studio")}
          />
          <ModeCard
            label="Quick"
            tagline="Identify & price in seconds"
            detail="Hold the phone over the card — live OCR streams matches like Google Lens."
            tint={p.accent.blue}
            active={!isStudio}
            onPress={() => setMode("quick")}
          />
        </View>

        {/* Primary CTA — Quick goes to the live-identify viewfinder
            (TCGplayer / Collectr-style streaming matches). Studio still
            opens the 4-shot photometric pipeline. */}
        <PrimaryButton
          label={isStudio ? "Grade a card" : "Quick scan"}
          icon={isStudio ? Camera : Zap}
          onPress={() =>
            router.push(isStudio ? routes.scanPhone("studio") : routes.scanIdentify())
          }
          variant={isStudio ? "mint" : "blue"}
          accessibilityLabel={isStudio ? "Start studio capture" : "Open quick scan"}
        />

        {/* Secondary paths — sometimes the user already knows what card
            they have (no scan needed) or wants to use the hardware
            scanner if they own one. We keep these one tap away rather
            than buried under a menu. */}
        <View>
          <SectionHeader eyebrow="Other ways" title="Skip the camera" />
          <View style={{ gap: 10 }}>
            <SecondaryRow
              icon={PlusCircle}
              tint={p.accent.amber}
              label="Add by catalog"
              detail="Pick the exact card, enter cost-basis."
              onPress={() => router.push(routes.gradeNew())}
            />
            <SecondaryRow
              icon={Smartphone}
              tint={connected ? p.accent.mint : p.ink.muted}
              label={
                connected ? "Hardware scanner ready" : "Pair Loupe scanner"
              }
              detail={
                connected
                  ? "Open the desktop app to capture from the cradle."
                  : "Connect the Bluetooth scanner for studio-grade results."
              }
              onPress={() => router.push("/scan/pair")}
            />
          </View>
        </View>

        {/* Soft brand footer — the page can feel sparse with just a
            mode picker and a button, so a small "why this matters"
            chip warms it up without adding noise. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(tint, 0.25),
            backgroundColor: withAlpha(tint, 0.06),
          }}
        >
          <Sparkles size={16} color={tint} />
          <Text
            style={{ color: p.ink.muted, fontSize: 12, flex: 1, lineHeight: 17 }}
          >
            Every scan trains your portfolio — grade once, track value forever.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface ModeCardProps {
  label: string;
  tagline: string;
  detail: string;
  tint: string;
  active: boolean;
  onPress: () => void;
}

function ModeCard({ label, tagline, detail, tint, active, onPress }: ModeCardProps) {
  const p = useThemedPalette();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        borderRadius: 16,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? tint : p.line.default,
        backgroundColor: active ? withAlpha(tint, 0.08) : p.bg.elevated,
        padding: 16,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: active ? tint : p.line.default,
          }}
        />
        <Text
          style={{
            color: active ? tint : p.ink.dim,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
      <Text style={{ color: p.ink.default, fontSize: 16, fontWeight: "600" }}>
        {tagline}
      </Text>
      <Text style={{ color: p.ink.muted, fontSize: 12, lineHeight: 17 }}>
        {detail}
      </Text>
    </Pressable>
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
