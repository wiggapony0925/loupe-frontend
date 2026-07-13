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
  Github,
  Info,
  LogOut,
  Mail,
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
import { useOnboarding } from "@/application/stores/onboardingStore";
import { useSettings, type Currency, type ThemeMode } from "@/application/stores/settingsStore";
import { useDisplayCurrency } from "@/application/hooks/useDisplayCurrency";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/application/queries/auth/useUserSettings";
import { CurrencyPickerSheet } from "@/presentation/components/CurrencyPickerSheet";
import { getCurrency } from "@/shared/currency";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { ProMembershipCard } from "@/presentation/features/pro";

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
  const p = useThemedPalette();

  return (
    <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
      <Pressable
        onPress={onBack}
        hitSlop={10}
        className="-ml-1 h-9 w-9 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={p.ink.default} />
      </Pressable>
      <Text className="text-base font-semibold tracking-tight text-ink">{title}</Text>
      <View className="h-9 w-9" />
    </View>
  );
}

/* ─── Robinhood-style menu page ──────────────────────────────────────── */

function MenuPage({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const p = useThemedPalette();
  const { user, signOut, signOutEverywhere } = useAuth();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const [copied, setCopied] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
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
          style={{ borderWidth: 2, borderColor: p.accent.mint }}
        >
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: `${p.accent.mint}22` }}
          >
            <Text className="text-lg font-bold" style={{ color: p.accent.mint }}>
              {initial}
            </Text>
          </View>
        </View>
      </View>

      {/* Loupe Pro membership — upgrade CTA for free users, billing for Pro.
          Renders nothing while subscriptions are switched off. */}
      <ProMembershipCard />

      {/* Menu rows — hairline separators, no card containers */}
      <View className="mt-2 border-t border-line">
        <MenuRow
          title="Loupe Support"
          subtitle="Help center, contact us 24/7, your support chats"
          onPress={() => router.push("/support")}
        />
        <MenuRow
          title="Blog"
          subtitle="Product news, set drops, and collecting guides"
          onPress={() => router.push("/blog")}
        />
        <MenuRow
          title="Manage subscription"
          subtitle="Loupe Pro plan, billing, usage, and benefits"
          onPress={() => router.push("/subscription")}
        />
        <MenuRow
          title="Statements"
          subtitle="Monthly & annual PDF portfolio statements"
          onPress={() => router.push("/statements")}
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
        {user?.is_admin ? (
          <MenuRow
            title="Developer portal"
            subtitle="Admin — users, Pro plan, flags, announcements"
            onPress={() => router.push("/admin")}
          />
        ) : null}
        {user?.is_admin ? (
          <MenuRow
            title="Replay login tutorial"
            subtitle="Admin — re-arm the first-login home tour for this account"
            onPress={() => {
              useOnboarding.getState().reset(String(user.id));
              router.replace("/(tabs)");
            }}
          />
        ) : null}
        <MenuRow
          title="Change password"
          subtitle="Update your password · signs out other devices"
          onPress={() => router.push("/change-password")}
        />
        <MenuRow
          title="Security and privacy"
          subtitle="Captures stay on-device until you grade · full policy"
          onPress={() => router.push("/legal/privacy")}
        />
        <MenuRow
          title="Legal"
          subtitle="Terms of service, privacy policy, cookies"
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
          onPress={() => {
            // Tap = do it (house style: no confirm popups). Logging out is
            // fully reversible — sign back in and the vault is untouched.
            signOut();
            router.replace("/");
          }}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            borderWidth: 1.5,
            borderColor: p.accent.rose,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          })}
        >
          <LogOut size={16} color={p.accent.rose} />
          <Text className="text-base font-bold" style={{ color: p.accent.rose }}>
            Log out
          </Text>
        </Pressable>

        {/* Secondary: revoke every device/session (kill switch for a lost
            device or stolen token). Subtle text link under the main pill. */}
        <Pressable
          onPress={async () => {
            // Immediate (house style) — revokes every session; recovering is
            // just signing back in, so no confirm dialog.
            setSigningOutAll(true);
            await signOutEverywhere();
            router.replace("/");
          }}
          disabled={signingOutAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sign out everywhere"
          style={({ pressed }) => ({
            opacity: pressed || signingOutAll ? 0.6 : 1,
            marginTop: 16,
            alignItems: "center",
          })}
        >
          <Text
            className="text-[13px] font-semibold text-ink-muted"
            style={{ textDecorationLine: "underline" }}
          >
            {signingOutAll ? "Signing out…" : "Sign out everywhere"}
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
  const p = useThemedPalette();

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
        <ChevronRight size={18} color={p.ink.dim} />
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
  iconTint,
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
  const p = useThemedPalette();
  const tint = iconTint ?? p.ink.muted;
  const Body = (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${isLast ? "" : "border-b border-line"}`}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tint}18` }}
      >
        <Icon size={16} color={tint} />
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
    disabled?: boolean;
  },
) {
  const p = useThemedPalette();
  const { value, onValueChange, disabled, ...rest } = props;
  return (
    <Row
      {...rest}
      trailing={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: p.line.default, true: p.accent.mint }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={p.line.default}
        />
      }
    />
  );
}

/* ─── General tab ────────────────────────────────────────────────────── */

function GeneralTab() {
  const p = useThemedPalette();
  const s = useSettings();
  // Currency changes also persist to the profile (PATCH /me/settings) so the
  // choice follows the user to the webapp and their other devices.
  const { currency, setCurrency } = useDisplayCurrency();
  return (
    <>
      <Section title="Currency">
        <CurrencyPicker value={currency} onChange={setCurrency} />
      </Section>

      <Section title="Capture">
        <ToggleRow
          icon={Wand2}
          iconTint={p.accent.blue}
          label="Auto OCR title detection"
          description="Read card title from the first capture before grading."
          value={s.autoOcr}
          onValueChange={s.toggleAutoOcr}
        />
        <ToggleRow
          icon={ShieldCheck}
          iconTint={p.accent.mint}
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
          iconTint={p.accent.amber}
          label="Haptic feedback"
          description="Subtle taps on capture, navigation, and grade reveal."
          value={s.hapticsEnabled}
          onValueChange={s.toggleHaptics}
          isLast
        />
      </Section>

      <NotificationsSection />

      <Pressable
        onPress={() => s.reset()}
        className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-line bg-bg-elevated px-5 py-4"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        accessibilityRole="button"
        accessibilityLabel="Reset settings"
      >
        <RotateCcw size={14} color={p.accent.rose} />
        <Text className="text-sm font-medium" style={{ color: p.accent.rose }}>
          Reset to defaults
        </Text>
      </Pressable>
    </>
  );
}

/**
 * Notifications — the toggles that live on the SERVER because the backend
 * acts on them (unlike the device-only capture/haptic prefs above). The push
 * switch gates whether the price worker sends alerts to this device; the email
 * switch gates product/blog emails. Optimistic via {@link useUpdateUserSettings}.
 */
function NotificationsSection() {
  const p = useThemedPalette();
  const { data: settings } = useUserSettings();
  const update = useUpdateUserSettings();
  const pending = update.isPending;
  const patch = update.variables;

  // Show the in-flight value while a patch is round-tripping, else the cache.
  const push = pending
    ? (patch?.push_notifications_enabled ?? settings?.push_notifications_enabled ?? true)
    : (settings?.push_notifications_enabled ?? true);
  const emails = pending
    ? (patch?.email_announcements_enabled ?? settings?.email_announcements_enabled ?? true)
    : (settings?.email_announcements_enabled ?? true);

  return (
    <Section title="Notifications">
      <ToggleRow
        icon={Bell}
        iconTint={p.accent.mint}
        label="Push notifications"
        description="Price alerts and scan results delivered to this device."
        value={push}
        disabled={!settings}
        onValueChange={(next) => update.mutate({ push_notifications_enabled: next })}
      />
      <ToggleRow
        icon={Mail}
        iconTint={p.accent.blue}
        label="Product updates & blog"
        description="Occasional emails about new features. Account emails always send."
        value={emails}
        disabled={!settings}
        onValueChange={(next) => update.mutate({ email_announcements_enabled: next })}
        isLast
      />
    </Section>
  );
}

function CurrencyPicker({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  const p = useThemedPalette();
  const [open, setOpen] = useState(false);
  const meta = getCurrency(value);
  const tint = meta.kind === "crypto" ? p.accent.amber : p.accent.mint;
  return (
    <View className="px-2 py-2">
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Display currency ${meta.code}. Tap to change.`}
        className="flex-row items-center gap-3 rounded-xl px-3 py-3"
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          backgroundColor: pressed ? `${p.ink.muted}11` : "transparent",
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
  const p = useThemedPalette();
  const themeMode = useSettings((s) => s.themeMode);
  const setThemeMode = useSettings((s) => s.setThemeMode);

  return (
    <>
      <Section title="Theme">
        <ThemePicker value={themeMode} onChange={setThemeMode} />
      </Section>

      <View className="rounded-2xl border border-line bg-bg-elevated p-4">
        <View className="flex-row items-center gap-2">
          <Sparkles size={13} color={p.accent.mint} />
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Precision palette
          </Text>
        </View>
        <Text className="mt-2 text-sm text-ink">
          Dark uses the original Precision palette for calibration accuracy in low-light grading.
          Light is a warm cream palette inspired by tinted album artwork.
        </Text>
        <View className="mt-3 flex-row items-center gap-2">
          <Swatch tint={p.accent.mint} label="Mint" />
          <Swatch tint={p.accent.blue} label="Blue" />
          <Swatch tint={p.accent.amber} label="Amber" />
          <Swatch tint={p.accent.rose} label="Rose" />
        </View>
      </View>
    </>
  );
}

function ThemePicker({ value, onChange }: { value: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const p = useThemedPalette();
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
            style={{ backgroundColor: active ? `${p.accent.mint}22` : "transparent" }}
          >
            <o.icon size={14} color={active ? p.accent.mint : p.ink.muted} />
            <Text
              className="text-[12px] font-semibold tracking-wider"
              style={{ color: active ? p.accent.mint : p.ink.muted }}
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
  const p = useThemedPalette();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const sdk = Constants.expoConfig?.sdkVersion ?? "—";
  const build = useMemo(() => `Build ${(Constants.nativeBuildVersion ?? "dev").toString()}`, []);

  return (
    <>
      <Section title="App">
        <Row icon={Info} label="Version" description={`${version} · Expo SDK ${sdk}`} />
        <Row icon={Sparkles} iconTint={p.accent.mint} label="Channel" description={build} />
        <Row
          icon={Camera}
          iconTint={p.accent.blue}
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
          trailing={<ChevronRight size={16} color={p.ink.dim} />}
          onPress={() =>
            void openExternalUrl(
              "https://github.com/wiggapony0925/loupe-frontend",
              "GitHub",
            )
          }
        />
        <Row
          icon={Shield}
          label="Privacy"
          description="Captures stay on-device until you grade · full policy"
          trailing={<ChevronRight size={16} color={p.ink.dim} />}
          onPress={() => router.push("/legal/privacy")}
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

/** Open a genuinely off-platform URL in the system browser (GitHub, etc.). */
async function openExternalUrl(url: string, label: string) {
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
  const p = useThemedPalette();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  return (
    <>
      {/* Legal docs are bundled in-app (chrome-less WebView), not kicked out to
          the system browser — same pattern as Support and Blog. */}
      <Section title="Documents">
        <Row
          icon={Shield}
          iconTint={p.accent.mint}
          label="Terms of service"
          description="Your agreement with Loupe — read before continuing."
          trailing={<ChevronRight size={16} color={p.ink.dim} />}
          onPress={() => router.push("/legal/terms")}
        />
        <Row
          icon={ShieldCheck}
          iconTint={p.accent.blue}
          label="Privacy policy"
          description="How we collect, store, and use your data."
          trailing={<ChevronRight size={16} color={p.ink.dim} />}
          onPress={() => router.push("/legal/privacy")}
        />
        <Row
          icon={Info}
          iconTint={p.accent.amber}
          label="Cookie policy"
          description="How Loupe uses cookies and local storage."
          trailing={<ChevronRight size={16} color={p.ink.dim} />}
          onPress={() => router.push("/legal/cookies")}
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
