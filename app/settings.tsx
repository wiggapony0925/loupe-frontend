import React, { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import {
  Bell,
  Bluetooth,
  Camera,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileText,
  Github,
  Info,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Newspaper,
  RotateCcw,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Users,
  Vibrate,
  Wand2,
  Wrench,
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
import { formatMoney, getCurrency } from "@/shared/currency";
import { useCollectionsOverview } from "@/application/queries/collection/useCollectionsOverview";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { useAuth } from "@/presentation/providers/AuthProvider";
import { ProMembershipCard } from "@/presentation/features/pro";
import {
  useCollectorProfile,
  useSocialMe,
} from "@/application/queries/social/useSocial";
import { SocialAvatar } from "@/presentation/features/social/SocialAvatar";
import { routes } from "@/shared/routes";

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
  // One identity everywhere: the hero bubble mirrors the community profile
  // picture, so changing it there updates this page too.
  const socialMe = useSocialMe();
  const socialProfile = socialMe.data?.profile ?? null;
  const requestCount = socialMe.data?.incoming_request_count ?? 0;
  // My own full profile stats (followers / views / likes) via the @me alias —
  // only fetched once a handle is claimed.
  const myStats = useCollectorProfile(socialProfile ? "@me" : null).data ?? null;
  // Canonical portfolio numbers — the backend's "All" overview entry.
  const overview = useCollectionsOverview().data ?? null;
  const allEntry = overview?.find((c) => c.is_all) ?? null;
  const binderCount = overview ? overview.filter((c) => !c.is_all).length : null;
  const { currency } = useDisplayCurrency();
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
      {/* Hero — large title + mint-ringed avatar bubble. The bubble shows the
          SAME picture as the community profile (one identity everywhere);
          tapping it opens community settings, where the picture is changed. */}
      <View className="flex-row items-center justify-between px-5 pb-4 pt-1">
        <Text className="text-[40px] font-bold tracking-tight text-ink">Settings</Text>
        <Pressable
          onPress={() =>
            router.push(
              socialProfile ? routes.communitySettings() : routes.community(),
            )
          }
          accessibilityRole="button"
          accessibilityLabel={
            socialProfile
              ? "Your profile picture. Opens community settings."
              : "Set up your community profile"
          }
          className="h-14 w-14 items-center justify-center rounded-full"
          style={({ pressed }) => [
            { borderWidth: 2, borderColor: p.accent.mint },
            pressed && { opacity: 0.7 },
          ]}
        >
          {socialProfile?.avatar_url ? (
            <SocialAvatar
              handle={socialProfile.username}
              name={displayName}
              url={socialProfile.avatar_url}
              size={44}
            />
          ) : (
            <View
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: `${p.accent.mint}22` }}
            >
              <Text className="text-lg font-bold" style={{ color: p.accent.mint }}>
                {initial}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Identity card — who you are here + your community reach. Taps
          through to the public profile (or to claiming a handle). */}
      <View className="px-5">
        <Pressable
          onPress={() =>
            router.push(socialProfile ? routes.myProfile() : routes.community())
          }
          accessibilityRole="button"
          accessibilityLabel={
            socialProfile ? "View my collector profile" : "Join the community"
          }
          style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
        >
          <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-bg-elevated px-4 py-4">
            {socialProfile ? (
              <SocialAvatar
                handle={socialProfile.username}
                url={socialProfile.avatar_url}
                size={52}
              />
            ) : (
              <View
                className="h-[52px] w-[52px] items-center justify-center rounded-full"
                style={{ backgroundColor: `${p.accent.mint}22` }}
              >
                <Text className="text-xl font-bold" style={{ color: p.accent.mint }}>
                  {initial}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text numberOfLines={1} className="text-[16px] font-bold text-ink">
                {displayName}
              </Text>
              <Text
                numberOfLines={1}
                className="mt-0.5 text-[12px] font-semibold"
                style={{ color: p.accent.mint }}
              >
                {socialProfile ? `@${socialProfile.username}` : "Claim your @handle"}
              </Text>
              <Text numberOfLines={1} className="mt-0.5 text-[11px] text-ink-dim">
                {myStats
                  ? `${myStats.follower_count.toLocaleString()} followers · ${myStats.view_count.toLocaleString()} profile views · ${myStats.like_count.toLocaleString()} likes`
                  : (user?.email ?? "")}
              </Text>
            </View>
            <ChevronRight size={18} color={p.ink.dim} />
          </View>
        </Pressable>

        {/* At-a-glance numbers — live backend data, each tile a shortcut. */}
        <View className="mt-3 flex-row" style={{ gap: 10 }}>
          <StatTile
            label="Portfolio"
            value={allEntry ? formatMoney(allEntry.total_value_usd, currency) : "—"}
            onPress={() => router.push(routes.analytics())}
          />
          <StatTile
            label="Cards"
            value={allEntry ? allEntry.card_count.toLocaleString() : "—"}
            onPress={() => router.push(routes.vault())}
          />
          <StatTile
            label="Collections"
            value={binderCount != null ? String(binderCount) : "—"}
            onPress={() => router.push(routes.vault())}
          />
        </View>
      </View>

      {/* Loupe Pro membership — upgrade CTA for free users, billing for Pro.
          Renders nothing while subscriptions are switched off. */}
      <ProMembershipCard />

      {/* Grouped menu — same Section/Row language as the sub-pages. */}
      <View className="mt-4 px-5" style={{ gap: 16 }}>
        <Section title="Collecting">
          <Row
            icon={Users}
            iconTint={p.accent.blue}
            label="Community"
            description="Follow collectors, share your collection"
            trailing={
              <View className="flex-row items-center" style={{ gap: 8 }}>
                {requestCount > 0 ? (
                  <View
                    className="items-center justify-center rounded-full px-1.5"
                    style={{ backgroundColor: p.accent.mint, minWidth: 20, height: 20 }}
                  >
                    <Text style={{ color: "#06140d", fontSize: 11, fontWeight: "800" }}>
                      {requestCount}
                    </Text>
                  </View>
                ) : null}
                <ChevronRight size={16} color={p.ink.dim} />
              </View>
            }
            onPress={() => router.push("/community")}
          />
          <Row
            icon={MapPin}
            iconTint={p.accent.rose}
            label="Card shops near me"
            description="Stores around you that sell trading cards, on a map"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/stores")}
          />
          <Row
            icon={FileText}
            iconTint={p.accent.purple}
            label="Statements"
            description="Monthly & annual PDF portfolio statements"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/statements")}
          />
          <Row
            icon={Bluetooth}
            iconTint={p.accent.mint}
            label="Devices"
            description="Loupe scanner, BLE pairing, firmware"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/scan/pair")}
          />
          <Row
            icon={Crown}
            iconTint={p.accent.amber}
            label="Manage subscription"
            description="Loupe Pro plan, billing, usage, and benefits"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/subscription")}
            isLast
          />
        </Section>

        <Section title="App">
          <Row
            icon={SlidersHorizontal}
            iconTint={p.accent.mint}
            label="Preferences"
            description="Currency, capture, haptics, notifications"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => onNavigate("general")}
          />
          <Row
            icon={Moon}
            iconTint={p.accent.blue}
            label="Appearance"
            description="Light, dark, system theme · precision palette"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => onNavigate("appearance")}
          />
          {user ? (
            <Row
              icon={RotateCcw}
              label="Replay introduction"
              description="Watch the home tour again"
              trailing={<ChevronRight size={16} color={p.ink.dim} />}
              onPress={() => {
                useOnboarding.getState().reset(String(user.id));
                router.replace("/(tabs)");
              }}
              isLast={!user.is_admin}
            />
          ) : null}
          {user?.is_admin ? (
            <Row
              icon={Wrench}
              iconTint={p.accent.amber}
              label="Developer portal"
              description="Admin — users, Pro plan, flags, announcements"
              trailing={<ChevronRight size={16} color={p.ink.dim} />}
              onPress={() => router.push("/admin")}
              isLast
            />
          ) : null}
        </Section>

        <Section title="Security">
          <Row
            icon={KeyRound}
            iconTint={p.accent.rose}
            label="Change password"
            description="Update your password · signs out other devices"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/change-password")}
          />
          <Row
            icon={ShieldCheck}
            iconTint={p.accent.mint}
            label="Security and privacy"
            description="Captures stay on-device until you grade · full policy"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/legal/privacy")}
          />
          <Row
            icon={Shield}
            label="Legal"
            description="Terms of service, privacy policy, cookies"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => onNavigate("legal")}
            isLast
          />
        </Section>

        <Section title="Resources">
          <Row
            icon={LifeBuoy}
            iconTint={p.accent.blue}
            label="Loupe Support"
            description="Help center, contact us 24/7, your support chats"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/support")}
          />
          <Row
            icon={Newspaper}
            iconTint={p.accent.amber}
            label="Blog"
            description="Product news, set drops, and collecting guides"
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => router.push("/blog")}
          />
          <Row
            icon={Info}
            label="About"
            description={`Version ${version} · build, source, credits`}
            trailing={<ChevronRight size={16} color={p.ink.dim} />}
            onPress={() => onNavigate("about")}
            isLast
          />
        </Section>
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
          style={({ pressed }) => [{
            opacity: pressed ? 0.7 : 1,
            borderWidth: 1.5,
            borderColor: p.accent.rose,
            borderRadius: 999,
            paddingVertical: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }]}
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
          style={({ pressed }) => [{
            opacity: pressed || signingOutAll ? 0.6 : 1,
            marginTop: 16,
            alignItems: "center",
          }]}
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

/** Robinhood-style number tile: big value, whisper label, tap = shortcut. */
function StatTile({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}
    >
      <View className="rounded-2xl border border-line bg-bg-elevated px-3 py-3">
        <Text numberOfLines={1} className="text-[18px] font-bold text-ink">
          {value}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-0.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-ink-dim"
        >
          {label}
        </Text>
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
  const build = (Constants.nativeBuildVersion ?? "dev").toString();
  // WHICH JS is actually running — the ground truth for "did the update
  // land?". Embedded = the bundle compiled into this build; an OTA id tail
  // identifies the exact published update.
  const runningJs = !Updates.isEnabled
    ? "dev · OTA disabled"
    : Updates.isEmbeddedLaunch
      ? "embedded JS"
      : `OTA …${(Updates.updateId ?? "").slice(-12)}`;

  return (
    <>
      <Section title="App">
        <Row icon={Info} label="Version" description={`${version} · Expo SDK ${sdk}`} />
        <Row
          icon={Sparkles}
          iconTint={p.accent.mint}
          label="Software"
          description={`Build ${build} · ${runningJs}`}
        />
        <UpdateCheckRow />
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

/**
 * Check-now row: taps straight through check → download → reload (the app
 * restarts on the new version). Status reads inline in the description —
 * no popups, per house taste.
 */
function UpdateCheckRow() {
  const p = useThemedPalette();
  const [status, setStatus] = useState<
    "idle" | "checking" | "downloading" | "current" | "error"
  >("idle");

  const description = !Updates.isEnabled
    ? "Unavailable in dev builds"
    : status === "checking"
      ? "Checking…"
      : status === "downloading"
        ? "Downloading — the app will refresh"
        : status === "current"
          ? "You're on the latest version"
          : status === "error"
            ? "Couldn't check — tap to try again"
            : "Fetch and apply the latest release now";

  const run = async () => {
    if (!Updates.isEnabled || status === "checking" || status === "downloading")
      return;
    try {
      setStatus("checking");
      const r = await Updates.checkForUpdateAsync();
      if (!r.isAvailable) {
        setStatus("current");
        return;
      }
      setStatus("downloading");
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      setStatus("error");
    }
  };

  return (
    <Row
      icon={RotateCcw}
      iconTint={p.accent.blue}
      label="Check for updates"
      description={description}
      trailing={<ChevronRight size={16} color={p.ink.dim} />}
      onPress={() => void run()}
    />
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
