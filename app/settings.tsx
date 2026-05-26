import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
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
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Vibrate,
  Wand2,
  type LucideIcon,
} from "lucide-react-native";
import { useSettings, type Currency, type ThemeMode } from "@/application/stores/settingsStore";
import { CurrencyPickerSheet } from "@/presentation/components/CurrencyPickerSheet";
import { getCurrency } from "@/shared/currency";
import { palette, useThemedPalette } from "@/presentation/theme/tokens";
import { useAuth } from "@/presentation/providers/AuthProvider";

type PageKey = "menu" | "general" | "appearance" | "legal" | "about";

const PAGE_TITLES: Record<PageKey, string> = {
  menu: "",
  general: "Preferences",
  appearance: "Appearance",
  legal: "Legal",
  about: "About",
};

export default function SettingsScreen() {
  useThemedPalette();
  const [page, setPage] = useState<PageKey>("menu");

  const onBack = () => {
    if (page === "menu") router.back();
    else setPage("menu");
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <Header title={PAGE_TITLES[page]} onBack={onBack} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        {page === "menu" && <MenuPage onNavigate={setPage} />}
        {page === "general" && (
          <View className="px-5 pt-2" style={{ gap: 16 }}>
            <GeneralTab />
          </View>
        )}
        {page === "appearance" && (
          <View className="px-5 pt-2" style={{ gap: 16 }}>
            <AppearanceTab />
          </View>
        )}
        {page === "legal" && (
          <View className="px-5 pt-2" style={{ gap: 16 }}>
            <LegalTab />
          </View>
        )}
        {page === "about" && (
          <View className="px-5 pt-2" style={{ gap: 16 }}>
            <AboutTab />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────── */

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
      <Pressable
        onPress={onBack}
        hitSlop={10}
        className="-ml-1 h-9 w-9 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={palette.ink.default} />
      </Pressable>
      <Text className="text-base font-semibold tracking-tight text-ink">{title}</Text>
      <View className="h-9 w-9" />
    </View>
  );
}

/* ─── Robinhood-style menu page ──────────────────────────────────────── */

function MenuPage({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const { user, signOut } = useAuth();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);
  const onCopyAccountId = async () => {
    const id = user?.id;
    if (!id) return;
    try {
      await Clipboard.setStringAsync(id);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      Alert.alert("Account ID", id);
    }
  };

  const displayName =
    user?.display_name?.trim() || user?.email?.split("@")[0] || "operator";
  const initial = displayName.charAt(0).toUpperCase();
  const handle = user?.email
    ? `@${user.email.split("@")[0]}`
    : `@${displayName.toLowerCase().replace(/\s+/g, "")}`;

  return (
    <View>
      {/* Hero — large title + mint-ringed avatar bubble */}
      <View className="flex-row items-center justify-between px-5 pb-4 pt-1">
        <Text className="text-[40px] font-bold tracking-tight text-ink">Settings</Text>
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ borderWidth: 2, borderColor: palette.accent.mint }}
        >
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: `${palette.accent.mint}22` }}
          >
            <Text className="text-lg font-bold" style={{ color: palette.accent.mint }}>
              {initial}
            </Text>
          </View>
        </View>
      </View>

      {/* Menu rows — hairline separators, no card containers */}
      <View className="mt-2 border-t border-line">
        <MenuRow
          title="Loupe Support"
          subtitle="Help center, contact us 24/7, your support chats"
          onPress={() =>
            Alert.alert(
              "Support",
              "Email support@loupe.app or visit help.loupe.app for 24/7 assistance.",
            )
          }
        />
        <MenuRow
          title="Preferences"
          subtitle="Currency, capture, haptics, notifications"
          onPress={() => onNavigate("general")}
        />
        <MenuRow
          title="Appearance"
          subtitle="Light, dark, system theme · precision palette"
          onPress={() => onNavigate("appearance")}
        />
        <MenuRow
          title="Devices"
          subtitle="Loupe scanner, BLE pairing, firmware"
          onPress={() => router.push("/scan/pair")}
        />
        <MenuRow
          title="Security and privacy"
          subtitle="Captures stay on-device until you grade"
          onPress={() =>
            Alert.alert(
              "Privacy",
              "Loupe never uploads your captures unless you tap Grade. OCR runs locally on your device.",
            )
          }
        />
        <MenuRow
          title="Legal"
          subtitle="Terms of service, privacy policy, acknowledgements"
          onPress={() => onNavigate("legal")}
        />
        <MenuRow
          title="About"
          subtitle={`Version ${version} · build, source, credits`}
          onPress={() => onNavigate("about")}
          isLast
        />
      </View>

      {/* Account info block */}
      <View className="mt-7 px-5">
        <Text className="text-[14px] font-bold text-ink">Account</Text>
        <Text className="mt-1 text-[14px] text-ink-muted">
          {user?.email ?? "Signed out"}
        </Text>
        <Pressable
          onPress={onCopyAccountId}
          hitSlop={6}
          disabled={!user?.id}
          accessibilityRole="button"
          accessibilityLabel={copied ? "Account ID copied" : "Copy account ID"}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          className="mt-2 flex-row items-center"
        >
          <Text
            className="text-[13px] font-semibold text-ink"
            style={{ textDecorationLine: "underline" }}
          >
            {copied ? "Copied account ID" : "Copy account ID"}
          </Text>
        </Pressable>

        <Text className="mt-5 text-[14px] font-bold text-ink">Username</Text>
        <Text className="mt-1 text-[14px] text-ink-muted">{handle}</Text>
      </View>

      {/* Log out — large outlined pill */}
      <View className="mt-7 px-5">
        <Pressable
          onPress={() =>
            Alert.alert("Log out?", "You'll need to sign in again to access your vault.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log out",
                style: "destructive",
                onPress: () => {
                  signOut();
                  router.replace("/");
                },
              },
            ])
          }
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            borderWidth: 1.5,
            borderColor: palette.accent.rose,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          })}
        >
          <LogOut size={16} color={palette.accent.rose} />
          <Text className="text-base font-bold" style={{ color: palette.accent.rose }}>
            Log out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MenuRow({
  title,
  subtitle,
  onPress,
  isLast = false,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      <View
        className={`flex-row items-center gap-3 px-5 py-5 ${isLast ? "" : "border-b border-line"}`}
      >
        <View className="flex-1">
          <Text className="text-[17px] font-semibold text-ink">{title}</Text>
          <Text className="mt-1 text-[13px] leading-[18px] text-ink-muted">{subtitle}</Text>
        </View>
        <ChevronRight size={18} color={palette.ink.dim} />
      </View>
    </Pressable>
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
        Made with mint · JFM Forensic Suite
      </Text>
      <Text className="mt-1 text-center text-[10px] text-ink-dim">
        © {new Date().getFullYear()} Loupe · All rights reserved
      </Text>
    </>
  );
}

/* ─── Legal tab ──────────────────────────────────────────────────────── */

const LEGAL_LINKS = {
  terms: "https://loupe.app/legal/terms",
  privacy: "https://loupe.app/legal/privacy",
  acknowledgements: "https://loupe.app/legal/acknowledgements",
} as const;

async function openLegal(url: string, label: string) {
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) {
      await Linking.openURL(url);
      return;
    }
  } catch {
    /* fall through to alert */
  }
  Alert.alert(label, url);
}

function LegalTab() {
  const version = Constants.expoConfig?.version ?? "0.1.0";
  return (
    <>
      <Section title="Documents">
        <Row
          icon={Shield}
          iconTint={palette.accent.mint}
          label="Terms of service"
          description="Your agreement with Loupe — read before continuing."
          trailing={<ChevronRight size={16} color={palette.ink.dim} />}
          onPress={() => openLegal(LEGAL_LINKS.terms, "Terms of service")}
        />
        <Row
          icon={ShieldCheck}
          iconTint={palette.accent.blue}
          label="Privacy policy"
          description="How we collect, store, and use your data."
          trailing={<ChevronRight size={16} color={palette.ink.dim} />}
          onPress={() => openLegal(LEGAL_LINKS.privacy, "Privacy policy")}
        />
        <Row
          icon={Info}
          iconTint={palette.accent.amber}
          label="Open-source acknowledgements"
          description="Credits for the libraries Loupe is built on."
          trailing={<ChevronRight size={16} color={palette.ink.dim} />}
          onPress={() =>
            openLegal(LEGAL_LINKS.acknowledgements, "Open-source acknowledgements")
          }
          isLast
        />
      </Section>

      <View className="mt-2 items-center">
        <Text className="text-[11px] text-ink-dim">
          Loupe v{version} · JFM Forensic Suite
        </Text>
        <Text className="mt-1 text-[10px] text-ink-dim">
          © {new Date().getFullYear()} Loupe · All rights reserved
        </Text>
      </View>
    </>
  );
}
