/**
 * Notifications — inbox for scan-complete alerts, price moves, and system
 * messages. The inbox is derived from REAL data: every price alert the
 * backend has flagged as triggered (`triggered_at != null`) becomes a
 * "market" notification. Scan/system categories will light up once those
 * event sources land server-side; until then they simply have no rows
 * (no mocks, no fabricated values).
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
import { useMoney } from "@/presentation/components/Price";
import { type Palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { WatchingList } from "@/presentation/features/watchlist/WatchingList";
import { usePriceAlerts } from "@/application/queries/alerts/usePriceAlerts";
import type { PriceAlertWire } from "@/infrastructure/http";

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
  /** Optional deep-link target (e.g. the card behind a price alert). */
  cardId?: string;
};

/** A triggered alert counts as "new" for 48h — there's no server-side
 *  read state yet, so recency is the honest proxy for unread. */
const UNREAD_WINDOW_MS = 48 * 60 * 60 * 1000;


/** Map the backend's triggered price alerts into inbox notifications.
 *  Only alerts the server has actually flagged (`triggered_at != null`)
 *  appear — we never fabricate a price move. */
function buildFeed(
  alerts: PriceAlertWire[],
  money: (usd: number, opts?: { compact?: boolean }) => string,
): Notification[] {
  const fmtMoney = (v: string | number | null): string | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? money(n, { compact: false }) : null;
  };
  return alerts
    .filter((a) => a.triggered_at !== null)
    .map((a) => {
      const name = a.card_name ?? "A watched card";
      const direction = a.condition === "above" ? "rose above" : "dropped below";
      const threshold = fmtMoney(a.threshold_usd);
      const hit = fmtMoney(a.triggered_price_usd);
      const triggeredAt = a.triggered_at as string;
      const isUnread =
        Date.now() - new Date(triggeredAt).getTime() < UNREAD_WINDOW_MS;
      return {
        id: a.id,
        category: "market" as const,
        title: `${name} hit your target`,
        body: hit
          ? `${direction} ${threshold} — last seen ${hit}`
          : `${direction} ${threshold}`,
        at: triggeredAt,
        unread: isUnread,
        cardId: a.card_id,
      };
    })
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
}

const CATEGORY_META: Record<
  Exclude<Category, "all">,
  { Icon: LucideIcon; tint: keyof Palette["accent"]; label: string }
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
  const p = useThemedPalette();
  // Deep-link support: a notification that says "your alert fired" can
  // route to `/notifications?tab=watching` and land users on the price-
  // alert list inside the same surface as the inbox.
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: Tab = params.tab === "watching" ? "watching" : "inbox";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<Category>("all");

  // Real inbox: triggered price alerts become "market" notifications.
  const alertsQ = usePriceAlerts({ pending: false });
  const { format: money } = useMoney();
  const feed = useMemo(
    () => buildFeed(alertsQ.data ?? [], money),
    [alertsQ.data, money],
  );

  const visible = useMemo(
    () => (filter === "all" ? feed : feed.filter((n) => n.category === filter)),
    [feed, filter],
  );
  const unreadCount = useMemo(
    () => feed.filter((n) => n.unread).length,
    [feed],
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
}: {
  value: Category;
  onChange: (v: Category) => void;
}) {
  const p = useThemedPalette();

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
              borderColor: active ? p.accent.mint : p.line.default,
              backgroundColor: active
                ? withAlpha(p.accent.mint, 0.14)
                : p.bg.elevated,
              opacity: pressed ? 0.7 : 1,
            })}
          >
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
  const p = useThemedPalette();
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
  const p = useThemedPalette();
  const meta = CATEGORY_META[item.category];
  const tint = p.accent[meta.tint];
  // A price-alert notification deep-links to the card it fired on.
  const onPress = item.cardId
    ? () => router.push(routes.card(item.cardId as string))
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
