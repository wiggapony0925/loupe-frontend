import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import {
  Bell,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Github,
  Info,
  Monitor,
  Moon,
  Palette as PaletteIcon,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  Vibrate,
  Wand2,
  type LucideIcon,
} from "lucide-react-native";
import { useSettings, type Currency, type ThemeMode } from "@/store/settingsStore";
import { CurrencyPickerSheet } from "@/components/ui/CurrencyPickerSheet";
import { getCurrency } from "@/lib/currency";
import { palette, useThemedPalette } from "@/theme/tokens";

type TabKey = "general" | "appearance" | "about";
const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "general", label: "General", icon: Sliders },
  { key: "appearance", label: "Appearance", icon: PaletteIcon },
  { key: "about", label: "About", icon: Info },
];

export default function SettingsScreen() {
  useThemedPalette();
  const [tab, setTab] = useState<TabKey>("general");

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <Header />
      <Tabs active={tab} onChange={setTab} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 64, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "general" && <GeneralTab />}
        {tab === "appearance" && <AppearanceTab />}
        {tab === "about" && <AboutTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────── */

function Header() {
  return (
    <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={18} color={palette.ink.default} />
      </Pressable>
      <Text className="text-base font-semibold tracking-tight text-ink">Settings</Text>
      <View className="h-9 w-9" />
    </View>
  );
}

/* ─── Tabs ────────────────────────────────────────────────────────────── */

function Tabs({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <View className="mx-5 mb-2 flex-row items-center gap-1 rounded-full border border-line bg-bg-elevated p-1">
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${t.label} tab`}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-3 py-2"
            style={{ backgroundColor: isActive ? `${palette.accent.mint}22` : "transparent" }}
          >
            <t.icon size={13} color={isActive ? palette.accent.mint : palette.ink.dim} />
            <Text
              className="text-xs font-semibold uppercase tracking-[2px]"
              style={{ color: isActive ? palette.accent.mint : palette.ink.dim }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Shared row primitives ──────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        {title}
      </Text>
      <View className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        {children}
      </View>
    </View>
  );
}

function Row({
  icon: Icon,
  iconTint = palette.ink.muted,
  label,
  description,
  trailing,
  onPress,
  isLast = false,
}: {
  icon: LucideIcon;
  iconTint?: string;
  label: string;
  description?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const Body = (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${isLast ? "" : "border-b border-line"}`}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${iconTint}1A` }}
      >
        <Icon size={15} color={iconTint} />
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-medium text-ink">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-[11px] text-ink-dim">{description}</Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        {Body}
      </Pressable>
    );
  }
  return Body;
}

function ToggleRow(
  props: Omit<Parameters<typeof Row>[0], "trailing"> & {
    value: boolean;
    onValueChange: (v: boolean) => void;
  },
) {
  const { value, onValueChange, ...rest } = props;
  return (
    <Row
      {...rest}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: palette.line.default, true: palette.accent.mint }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={palette.line.default}
        />
      }
    />
  );
}

/* ─── General tab ────────────────────────────────────────────────────── */

function GeneralTab() {
  const s = useSettings();
  return (
    <>
      <Section title="Currency">
        <CurrencyPicker value={s.currency} onChange={s.setCurrency} />
      </Section>

      <Section title="Capture">
        <ToggleRow
          icon={Wand2}
          iconTint={palette.accent.blue}
          label="Auto OCR title detection"
          description="Read card title from the first capture before grading."
          value={s.autoOcr}
          onValueChange={s.toggleAutoOcr}
        />
        <ToggleRow
          icon={ShieldCheck}
          iconTint={palette.accent.mint}
          label="Quality gate"
          description="Reject blurry or glared shots before upload."
          value={s.qualityGate}
          onValueChange={s.toggleQualityGate}
          isLast
        />
      </Section>

      <Section title="Feedback">
        <ToggleRow
          icon={Vibrate}
          iconTint={palette.accent.amber}
          label="Haptic feedback"
          description="Subtle taps on capture, navigation, and grade reveal."
          value={s.hapticsEnabled}
          onValueChange={s.toggleHaptics}
          isLast
        />
      </Section>

      <Section title="Notifications">
        <ToggleRow
          icon={Bell}
          iconTint={palette.accent.mint}
          label="Scan complete"
          description="Notify when a forensic report finishes processing."
          value={s.scanCompleteAlerts}
          onValueChange={s.toggleScanCompleteAlerts}
        />
        <ToggleRow
          icon={CircleDollarSign}
          iconTint={palette.accent.blue}
          label="Price drops"
          description="Alert when a vault card moves more than 10%."
          value={s.priceDropAlerts}
          onValueChange={s.togglePriceDropAlerts}
          isLast
        />
      </Section>

      <Pressable
        onPress={() =>
          Alert.alert("Reset settings?", "Restore all preferences to their defaults.", [
            { text: "Cancel", style: "cancel" },
            { text: "Reset", style: "destructive", onPress: () => s.reset() },
          ])
        }
        className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-bg-elevated px-5 py-4"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        accessibilityRole="button"
        accessibilityLabel="Reset settings"
      >
        <RotateCcw size={14} color={palette.accent.rose} />
        <Text className="text-sm font-medium" style={{ color: palette.accent.rose }}>
          Reset to defaults
        </Text>
      </Pressable>
    </>
  );
}

function CurrencyPicker({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  const [open, setOpen] = useState(false);
  const meta = getCurrency(value);
  const tint = meta.kind === "crypto" ? palette.accent.amber : palette.accent.mint;
  return (
    <View className="px-2 py-2">
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Display currency ${meta.code}. Tap to change.`}
        className="flex-row items-center gap-3 rounded-xl px-3 py-3"
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          backgroundColor: pressed ? `${palette.ink.muted}11` : "transparent",
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${tint}22`,
          }}
        >
          <Text style={{ fontSize: 18 }}>{meta.flag}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text className="text-[15px] font-semibold text-ink">
            {meta.code} · {meta.name}
          </Text>
          <Text className="mt-0.5 text-[11px] text-ink-muted">
            Tap to choose from 20+ fiat & crypto currencies
          </Text>
        </View>
        <Text
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: tint }}
        >
          Change
        </Text>
      </Pressable>
      <CurrencyPickerSheet
        visible={open}
        selected={value}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

/* ─── Appearance tab ─────────────────────────────────────────────────── */

function AppearanceTab() {
  const themeMode = useSettings((s) => s.themeMode);
  const setThemeMode = useSettings((s) => s.setThemeMode);

  return (
    <>
      <Section title="Theme">
        <ThemePicker value={themeMode} onChange={setThemeMode} />
      </Section>

      <View className="rounded-2xl border border-line bg-bg-elevated p-4">
        <View className="flex-row items-center gap-2">
          <Sparkles size={13} color={palette.accent.mint} />
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Precision palette
          </Text>
        </View>
        <Text className="mt-2 text-sm text-ink">
          Dark uses the original Precision palette for calibration accuracy in low-light grading.
          Light is a warm cream palette inspired by tinted album artwork.
        </Text>
        <View className="mt-3 flex-row items-center gap-2">
          <Swatch tint={palette.accent.mint} label="Mint" />
          <Swatch tint={palette.accent.blue} label="Blue" />
          <Swatch tint={palette.accent.amber} label="Amber" />
          <Swatch tint={palette.accent.rose} label="Rose" />
        </View>
      </View>
    </>
  );
}

function ThemePicker({ value, onChange }: { value: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const opts: { m: ThemeMode; label: string; icon: LucideIcon }[] = [
    { m: "light", label: "Light", icon: Sun },
    { m: "dark", label: "Dark", icon: Moon },
    { m: "system", label: "Auto", icon: Monitor },
  ];
  return (
    <View className="flex-row items-center gap-1 p-1.5">
      {opts.map((o) => {
        const active = o.m === value;
        return (
          <Pressable
            key={o.m}
            onPress={() => onChange(o.m)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label} theme`}
            className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-3"
            style={{ backgroundColor: active ? `${palette.accent.mint}22` : "transparent" }}
          >
            <o.icon size={14} color={active ? palette.accent.mint : palette.ink.muted} />
            <Text
              className="text-[12px] font-semibold tracking-wider"
              style={{ color: active ? palette.accent.mint : palette.ink.muted }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Swatch({ tint, label }: { tint: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-xl border border-line bg-bg p-2">
      <View className="h-6 w-6 rounded-full" style={{ backgroundColor: tint }} />
      <Text className="mt-1 text-[10px] font-medium text-ink-dim">{label}</Text>
    </View>
  );
}

/* ─── About tab ──────────────────────────────────────────────────────── */

function AboutTab() {
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const sdk = Constants.expoConfig?.sdkVersion ?? "—";
  const build = useMemo(() => `Build ${(Constants.nativeBuildVersion ?? "dev").toString()}`, []);

  return (
    <>
      <Section title="App">
        <Row icon={Info} label="Version" description={`${version} · Expo SDK ${sdk}`} />
        <Row icon={Sparkles} iconTint={palette.accent.mint} label="Channel" description={build} />
        <Row
          icon={Camera}
          iconTint={palette.accent.blue}
          label="Capture engine"
          description="Photometric 4-light + JS quality gate"
          isLast
        />
      </Section>

      <Section title="Resources">
        <Row
          icon={Github}
          label="Source on GitHub"
          description="github.com/wiggapony0925/loupe-frontend"
          trailing={<ChevronRight size={16} color={palette.ink.dim} />}
          onPress={() =>
            Alert.alert("Open in browser?", "https://github.com/wiggapony0925/loupe-frontend", [
              { text: "OK" },
            ])
          }
        />
        <Row
          icon={Shield}
          label="Privacy"
          description="Captures stay on-device until you grade."
          trailing={<ChevronRight size={16} color={palette.ink.dim} />}
          onPress={() =>
            Alert.alert(
              "Privacy",
              "Loupe never uploads your captures unless you tap Grade. OCR runs locally.",
            )
          }
          isLast
        />
      </Section>

      <Text className="mt-2 text-center text-[11px] text-ink-dim">
        Made with mint · {new Date().getFullYear()} JFM Forensic Suite
      </Text>
    </>
  );
}
