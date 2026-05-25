/**
 * Notifications — inbox for scan-complete alerts, price moves, and system
 * messages. Today it renders a static placeholder; once the backend exposes
 * `/v1/notifications` we'll swap the inline `MOCK_FEED` for a React Query
 * hook against the repository layer (mirroring `forensicRepository`).
 *
 * The empty state previews three faint "ghost" rows so users can read the
 * eventual layout before any real notification has arrived — much friendlier
 * than an isolated icon-in-a-card.
 */

import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronLeft,
  Settings2,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react-native";
import { routes } from "@/shared/routes";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { WatchingList } from "@/presentation/features/watchlist/WatchingList";

type Category = "all" | "scan" | "market" | "system";
type Tab = "inbox" | "watching";

type Notification = {
  id: string;
  category: Exclude<Category, "all">;
  title: string;
  body: string;
  /** ISO timestamp — formatted for display via `relative()`. */
  at: string;
  unread: boolean;
};

const MOCK_FEED: Notification[] = [];

const CATEGORY_META: Record<
  Exclude<Category, "all">,
  { Icon: LucideIcon; tint: keyof typeof palette.accent; label: string }
> = {
  scan: { Icon: Sparkles, tint: "mint", label: "Scan" },
  market: { Icon: TrendingUp, tint: "blue", label: "Market" },
  system: { Icon: Bell, tint: "amber", label: "System" },
};

const FILTERS: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scan", label: "Scans" },
  { key: "market", label: "Market" },
  { key: "system", label: "System" },
];

export default function NotificationsScreen() {
  useThemedPalette();
  // Deep-link support: a notification that says "your alert fired" can
  // route to `/notifications?tab=watching` and land users on the price-
  // alert list inside the same surface as the inbox.
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: Tab = params.tab === "watching" ? "watching" : "inbox";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<Category>("all");

  const visible = useMemo(
    () => (filter === "all" ? MOCK_FEED : MOCK_FEED.filter((n) => n.category === filter)),
    [filter],
  );
  const unreadCount = useMemo(
    () => MOCK_FEED.filter((n) => n.unread).length,
    [],
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <Header
        unreadCount={unreadCount}
        onBack={() => router.back()}
        onOpenSettings={() => router.push(routes.settings())}
      />
      {/* Eyebrow + title — matches the Settings hero rhythm but scaled
          down so this screen reads as an inbox, not a marketing page. */}
      <View className="px-5 pb-3 pt-1">
        <Text className="text-[11px] font-semibold uppercase tracking-[3px] text-ink-dim">
          {tab === "watching" ? "Watching · live" : "Inbox · live"}
        </Text>
        <View className="mt-1 flex-row items-end justify-between">
          <Text className="text-[28px] font-bold tracking-tight text-ink">
            Notifications
          </Text>
          {tab === "inbox" && unreadCount > 0 ? (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: withAlpha(palette.accent.mint, 0.18) }}
            >
              <Text
                className="text-[11px] font-bold"
                style={{ color: palette.accent.mint, letterSpacing: 0.4 }}
              >
                {unreadCount} NEW
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-[13px] text-ink-muted">
          {tab === "watching"
            ? "Every card you're tracking with a price threshold."
            : "Scan reports, watched-comp moves, and system updates land here."}
        </Text>
      </View>

      {/* Inbox vs Watching segmented control. Watch used to live as a
          dedicated bottom tab — it was confusing next to the bell and
          burned a slot that Scan now occupies. Folding it in here keeps
          both surfaces one tap from anywhere via the global bell. */}
      <TabSegment value={tab} onChange={setTab} />

      {tab === "watching" ? (
        <View style={{ flex: 1 }}>
          <WatchingList showHeader={false} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 64 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Category filter strip — visible even in the empty state so users
              understand the eventual shape of the feed. */}
          <FilterStrip value={filter} onChange={setFilter} />

          {visible.length === 0 ? (
            <EmptyState filter={filter} hasUnread={unreadCount > 0} />
          ) : (
            <Feed items={visible} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ─── Tab segmented control ───────────────────────────────────────────── */

function TabSegment({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.line.default,
        backgroundColor: palette.bg.elevated,
      }}
    >
      {(["inbox", "watching"] as const).map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: active
                ? withAlpha(palette.accent.mint, 0.16)
                : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: active ? palette.accent.mint : palette.ink.muted,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {opt === "inbox" ? "Inbox" : "Watching"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────── */

function Header({
  unreadCount,
  onBack,
  onOpenSettings,
}: {
  unreadCount: number;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between px-3 pb-2 pt-2">
      <Pressable
        onPress={onBack}
        hitSlop={10}
        className="h-9 w-9 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={palette.ink.default} />
      </Pressable>
      <Text className="text-[13px] font-semibold tracking-tight text-ink-muted">
        {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
      </Text>
      <Pressable
        onPress={onOpenSettings}
        hitSlop={10}
        className="h-9 w-9 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Notification settings"
      >
        <Settings2 size={18} color={palette.ink.muted} />
      </Pressable>
    </View>
  );
}

/* ─── Filter strip ────────────────────────────────────────────────────── */

function FilterStrip({
  value,
  onChange,
}: {
  value: Category;
  onChange: (v: Category) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
    >
      {FILTERS.map((f) => {
        const active = value === f.key;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: active ? palette.accent.mint : palette.line.default,
              backgroundColor: active
                ? withAlpha(palette.accent.mint, 0.14)
                : palette.bg.elevated,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: active ? palette.accent.mint : palette.ink.muted,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.4,
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────── */

function EmptyState({
  filter,
  hasUnread,
}: {
  filter: Category;
  hasUnread: boolean;
}) {
  const title =
    filter === "all"
      ? hasUnread
        ? "Nothing else right now"
        : "You're all caught up"
      : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} alerts yet`;

  return (
    <View className="mt-4 px-5">
      {/* Hero icon — concentric mint rings for a richer "empty" moment. */}
      <View className="items-center pt-2">
        <View
          className="h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: withAlpha(palette.accent.mint, 0.08) }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(palette.accent.mint, 0.16) }}
          >
            {hasUnread ? (
              <CheckCheck size={24} color={palette.accent.mint} />
            ) : (
              <BellOff size={22} color={palette.accent.mint} />
            )}
          </View>
        </View>
        <Text className="mt-4 text-[17px] font-semibold text-ink">{title}</Text>
        <Text className="mt-1 text-center text-[13px] leading-[19px] text-ink-muted">
          We'll ping you here when a forensic scan finishes, a watched comp
          moves more than your threshold, or Loupe ships an update worth a look.
        </Text>
      </View>

      {/* Preview section — three ghost rows show what real notifications
          will look like. They're non-interactive and dimmed so users
          read them as samples, not as live items. */}
      <Text className="mt-9 px-1 text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        Preview · sample alerts
      </Text>
      <View
        className="mt-2 overflow-hidden rounded-2xl border border-line bg-bg-elevated"
        pointerEvents="none"
      >
        <GhostRow
          category="scan"
          title="Forensic report ready"
          body="Charizard 1999 Holo · Grade 9.5 · 92% confidence"
          when="2m"
        />
        <GhostRow
          category="market"
          title="Watched comp moved"
          body="PSA 10 Pikachu Illustrator · +4.2% in the last 24h"
          when="1h"
        />
        <GhostRow
          category="system"
          title="Loupe scanner firmware v1.2"
          body="Faster light cycle and a sharper macro lens profile."
          when="2d"
          isLast
        />
      </View>
    </View>
  );
}

function GhostRow({
  category,
  title,
  body,
  when,
  isLast = false,
}: {
  category: Exclude<Category, "all">;
  title: string;
  body: string;
  when: string;
  isLast?: boolean;
}) {
  const meta = CATEGORY_META[category];
  const tint = palette.accent[meta.tint];
  return (
    <View
      className={`flex-row items-start gap-3 px-4 py-3.5 ${isLast ? "" : "border-b border-line"}`}
      style={{ opacity: 0.55 }}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: withAlpha(tint, 0.14) }}
      >
        <meta.Icon size={15} color={tint} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-[14px] font-semibold text-ink">{title}</Text>
          <Text className="text-[11px] text-ink-dim">{when}</Text>
        </View>
        <Text numberOfLines={2} className="mt-0.5 text-[12px] leading-[17px] text-ink-muted">
          {body}
        </Text>
      </View>
    </View>
  );
}

/* ─── Feed ────────────────────────────────────────────────────────────── */

function Feed({ items }: { items: Notification[] }) {
  return (
    <View className="mt-3 border-t border-line">
      {items.map((n, idx) => (
        <NotificationRow key={n.id} item={n} isLast={idx === items.length - 1} />
      ))}
    </View>
  );
}

function NotificationRow({
  item,
  isLast,
}: {
  item: Notification;
  isLast: boolean;
}) {
  const meta = CATEGORY_META[item.category];
  const tint = palette.accent[meta.tint];
  return (
    <View
      className={`flex-row items-start gap-3 px-5 py-4 ${isLast ? "" : "border-b border-line"}`}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: withAlpha(tint, 0.14) }}
      >
        <meta.Icon size={16} color={tint} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-[15px] font-semibold text-ink">{item.title}</Text>
          <Text className="text-[11px] text-ink-dim">{relative(item.at)}</Text>
        </View>
        <Text className="mt-1 text-[13px] leading-[18px] text-ink-muted">
          {item.body}
        </Text>
      </View>
      {item.unread ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: palette.accent.mint,
            marginTop: 6,
          }}
        />
      ) : null}
    </View>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d`;
}
