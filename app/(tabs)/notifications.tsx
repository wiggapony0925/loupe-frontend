/**
 * Notifications — inbox for scan-complete alerts, price moves, and system
 * messages. The inbox is derived from REAL data: every price alert the
 * backend has flagged as triggered (`triggered_at != null`) becomes a
 * "market" notification. Scan/system categories will light up once those
 * event sources land server-side; until then they simply have no rows
 * (no mocks, no fabricated values).
 */

import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bell,
  BellOff,
  CheckCheck,
  ChevronLeft,
  CreditCard,
  Settings2,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import { routes } from "@/shared/routes";
import { type Palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { WatchingList } from "@/presentation/features/watchlist/WatchingList";
import {
  useNotificationCategories,
  useNotificationFeed,
} from "@/application/notifications/useNotificationFeed";
import type { NotificationCategoryTab } from "@/application/notifications/useNotificationFeed";
import { useCommunityIslandPresence } from "@/presentation/navigation/CommunityIsland";
import { useScreenTransition } from "@/presentation/navigation/screenMotion";
import type { FeedItem } from "@/application/notifications/notificationFeed";

/** `"all"`, or any category key the server sends. Deliberately open: the
 *  catalogue lives on the backend, so a closed union here would mean a new
 *  category could not appear without shipping an app. */
type Category = "all" | (string & {});

interface CategoryVisual {
  Icon: LucideIcon;
  tint: keyof Palette["accent"];
  label: string;
}
type Tab = "inbox" | "watching";





/** Icon + tint per STORED category. The labels and ordering come from the
 *  server; this table is only the visual vocabulary, which is per-platform
 *  by nature (a lucide component can't travel over JSON). Keyed by the
 *  literal five so `.system` is a guaranteed fallback, not a lookup that
 *  might miss. */
const CATEGORY_META: {
  system: CategoryVisual;
} & Record<string, CategoryVisual | undefined> = {
  market: { Icon: TrendingUp, tint: "blue", label: "Market" },
  news: { Icon: Sparkles, tint: "mint", label: "News" },
  social: { Icon: Users, tint: "purple", label: "Community" },
  billing: { Icon: CreditCard, tint: "amber", label: "Billing" },
  system: { Icon: Bell, tint: "amber", label: "System" },
};

/** The one tab the server does NOT send: "no filter". */
const ALL_TAB = { key: "all", label: "All", unread: 0 } as const;

export default function NotificationsScreen() {
  const p = useThemedPalette();
  // Deep-link support: a notification that says "your alert fired" can
  // route to `/notifications?tab=watching` and land users on the price-
  // alert list inside the same surface as the inbox.
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: Tab = params.tab === "watching" ? "watching" : "inbox";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<Category>("all");

  // The island navbar stays on screen here (this route lives in the tab
  // group), so you can drag straight back to the feed instead of being
  // stranded with a back button.
  useCommunityIslandPresence();
  // Inbox ⇄ Watching is a content swap, not a navigation — same motion as
  // moving between pages, from the one shared definition.
  const swap = useScreenTransition(`${tab}:${filter}`);

  // One shared feed — the same one the navbar bell counts, so the badge and
  // this list can never disagree about what's waiting.
  const {
    feed,
    unread: unreadCount,
    markAllRead,
    hasMore,
    loadMore,
    isLoading,
    isLoadingMore,
  } = useNotificationFeed(filter === "all" ? undefined : filter);
  // Which tabs exist, what they are called, and how many are waiting in
  // each — all from the server, so this strip never drifts from web.
  const { categories } = useNotificationCategories();

  // Opening the inbox IS reading it. Anything else leaves a badge the user has
  // to dismiss by hand, which is a chore nobody asked for.
  //
  // This can't fire on mount alone any more: the feed now arrives over the
  // network, so on the first render there is nothing to mark. It waits for the
  // first non-empty load and then runs exactly once — `didMark` is what stops
  // it re-firing as later pages append.
  const didMark = useRef(false);
  useEffect(() => {
    if (!didMark.current && feed.length > 0) {
      didMark.current = true;
      markAllRead();
    }
  }, [feed.length, markAllRead]);

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
          {tab === "watching" ? "Favorites · alerts" : "Inbox · live"}
        </Text>
        <View className="mt-1 flex-row items-end justify-between">
          <Text className="text-[28px] font-bold tracking-tight text-ink">
            Notifications
          </Text>
          {tab === "inbox" && unreadCount > 0 ? (
            <View
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: withAlpha(p.accent.mint, 0.18) }}
            >
              <Text
                className="text-[11px] font-bold"
                style={{ color: p.accent.mint, letterSpacing: 0.4 }}
              >
                {unreadCount} NEW
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="mt-1 text-[13px] text-ink-muted">
          {tab === "watching"
            ? "Favorite cards and every price threshold you have set."
            : "Scan reports, watched-comp moves, and system updates land here."}
        </Text>
      </View>

      {/* Inbox vs Favorites segmented control. Watch used to live as a
          dedicated bottom tab — it was confusing next to the bell and
          burned a slot that Scan now occupies. Folding it in here keeps
          both surfaces one tap from anywhere via the global bell. */}
      <TabSegment value={tab} onChange={setTab} />

      {tab === "watching" ? (
        <Animated.View style={[{ flex: 1 }, swap]}>
          <WatchingList showHeader={false} />
        </Animated.View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Category filter strip — visible even in the empty state so users
              understand the eventual shape of the feed. */}
          <FilterStrip
            value={filter}
            onChange={setFilter}
            categories={categories}
          />

          <Animated.View style={swap}>
          {feed.length === 0 ? (
            <EmptyState
              filter={filter}
              filterLabel={
                categories.find((c) => c.key === filter)?.label ?? "matching"
              }
              hasUnread={unreadCount > 0}
              isLoading={isLoading}
            />
          ) : (
            <>
              <Feed items={feed} />
              {/* The server filters, so "has more" is the truth about THIS
                  tab — not about an inbox we would have to keep paging
                  through to find the next matching row. */}
              {hasMore ? (
                <LoadMore onPress={loadMore} busy={isLoadingMore} />
              ) : null}
            </>
          )}
          </Animated.View>
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
  const p = useThemedPalette();

  return (
    <View
      style={{
        flexDirection: "row",
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
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
                  ? withAlpha(p.accent.mint, 0.16)
                : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: active ? p.accent.mint : p.ink.muted,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {opt === "inbox" ? "Inbox" : "Favorites"}
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
  const p = useThemedPalette();

  return (
    <View className="flex-row items-center justify-between px-3 pb-2 pt-2">
      <Pressable
        onPress={onBack}
        hitSlop={10}
        className="h-9 w-9 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={22} color={p.ink.default} />
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
        <Settings2 size={18} color={p.ink.muted} />
      </Pressable>
    </View>
  );
}

/* ─── Filter strip ────────────────────────────────────────────────────── */

function FilterStrip({
  value,
  onChange,
  categories,
}: {
  value: Category;
  onChange: (v: Category) => void;
  categories: NotificationCategoryTab[];
}) {
  const p = useThemedPalette();
  // "All" is ours; everything after it is whatever the server says exists.
  // Before the summary lands we render "All" alone rather than a guess —
  // a strip that changes labels under the user's thumb is worse than one
  // that arrives a beat late.
  const tabs = [
    ALL_TAB,
    ...categories.map((c) => ({
      key: c.key,
      label: c.label,
      unread: c.unread,
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
    >
      {tabs.map((f) => {
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
              borderColor: active ? p.accent.mint : p.line.default,
              backgroundColor: active
                ? withAlpha(p.accent.mint, 0.14)
                : p.bg.elevated,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  color: active ? p.accent.mint : p.ink.muted,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 0.4,
                }}
              >
                {f.label}
              </Text>
              {f.unread > 0 ? (
                <View
                  style={{
                    minWidth: 16,
                    paddingHorizontal: 4,
                    height: 16,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active
                      ? p.accent.mint
                      : withAlpha(p.ink.dim, 0.16),
                  }}
                >
                  <Text
                    style={{
                      color: active ? p.bg.base : p.ink.muted,
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    {f.unread > 99 ? "99+" : f.unread}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ─── Empty state ─────────────────────────────────────────────────────── */

function EmptyState({
  filter,
  filterLabel,
  hasUnread,
  isLoading = false,
}: {
  filter: Category;
  filterLabel: string;
  hasUnread: boolean;
  isLoading?: boolean;
}) {
  const p = useThemedPalette();
  // The inbox arrives over the network now, so the first render is genuinely
  // empty. Saying "you're all caught up" before the answer is back would be a
  // confident lie that flickers into a list a moment later.
  const title = isLoading
    ? "Loading your inbox…"
    : filter === "all"
      ? hasUnread
        ? "Nothing else right now"
        : "You're all caught up"
      : `No ${filterLabel.toLowerCase()} notifications yet`;

  return (
    <View className="mt-4 px-5">
      {/* Hero icon — concentric mint rings for a richer "empty" moment. */}
      <View className="items-center pt-2">
        <View
          className="h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: withAlpha(p.accent.mint, 0.08) }}
        >
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.16) }}
          >
            {hasUnread ? (
              <CheckCheck size={24} color={p.accent.mint} />
            ) : (
              <BellOff size={22} color={p.accent.mint} />
            )}
          </View>
        </View>
        <Text className="mt-4 text-[17px] font-semibold text-ink">{title}</Text>
        <Text className="mt-1 text-center text-[13px] leading-[19px] text-ink-muted">
          We'll ping you here when a forensic scan finishes, a watched comp
          moves more than your threshold, or Loupe ships an update worth a look.
        </Text>
      </View>
    </View>
  );
}

/* ─── Load more ───────────────────────────────────────────────────────── */

/**
 * Explicit paging rather than infinite scroll. An inbox is something people
 * scan and leave; auto-loading on scroll would keep fetching pages nobody
 * asked for while they hunt for one alert near the top.
 */
function LoadMore({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className="mt-4 items-center justify-center rounded-2xl border border-line py-3.5"
      accessibilityRole="button"
      accessibilityLabel="Load older notifications"
    >
      <Text className="text-[13px] font-semibold text-ink-muted">
        {busy ? "Loading…" : "Load older"}
      </Text>
    </Pressable>
  );
}

/* ─── Feed ────────────────────────────────────────────────────────────── */

function Feed({ items }: { items: FeedItem[] }) {
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
  item: FeedItem;
  isLast: boolean;
}) {
  const p = useThemedPalette();
  // An unrecognised category still renders — a notification we can't
  // classify is still one the user was meant to see.
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META.system;
  const tint = p.accent[meta.tint];
  // A price-alert notification deep-links to the card it fired on.
  const onPress = item.href
    ? () => router.push(item.href as never)
    : undefined;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ opacity: pressed && onPress ? 0.6 : 1 })}
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
          <Text numberOfLines={1} className="flex-1 pr-2 text-[15px] font-semibold text-ink">
            {item.title}
          </Text>
          {item.at ? (
            <Text className="text-[11px] text-ink-dim">{relative(item.at)}</Text>
          ) : null}
        </View>
        <Text className="mt-1 text-[13px] leading-[18px] text-ink-muted">
          {item.body ?? ""}
        </Text>
      </View>
      {item.unread ? (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: p.accent.mint,
            marginTop: 6,
          }}
        />
      ) : null}
    </Pressable>
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
