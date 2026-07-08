import React from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Camera, Plus, X } from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { usePublicSparklines } from "@/application/queries/catalog/usePublicSparklines";
import { useCompactUsd } from "@/shared/format";
import { GLASS_STRONG } from "./theme";
import { CandidateCardImage } from "./CandidateCardImage";
import type { ScanSessionItem } from "./types";

/**
 * The rolling scan-session tray: every captured frame as a tile that
 * resolves from photo → matched card (art + live price + "you own this")
 * or → missed (tap to search manually). Header shows N/M matched, a live
 * running TOTAL priced by the backend's public-sparklines endpoint, a
 * free-tier slot warning, and one-tap "Add all". Shared by both scanner
 * surfaces so a stack-scan behaves identically on iOS and Android.
 */
export function ScanSessionTray({
  items,
  themed,
  formatUsd,
  onPick,
  onRemove,
  onSearchManually,
  onAddAll,
  addAllCount = 0,
  slotsLeft = null,
}: {
  items: ScanSessionItem[];
  themed: ReturnType<typeof useThemedPalette>;
  formatUsd: (v: number) => string;
  onPick: (item: ScanSessionItem) => void;
  onRemove: (id: string) => void;
  onSearchManually?: () => void;
  /** Bulk "save every matched capture to the vault" — omitted when the
   *  host didn't wire a batch handler or nothing has matched yet. */
  onAddAll?: () => void;
  addAllCount?: number;
  slotsLeft?: number | null;
}) {
  const matched = items.filter((i) => i.status === "matched" && i.candidate != null);
  // Running session total — one batch request prices every matched capture.
  const ids = matched
    .map((i) => i.candidate?.upstream_id ?? i.candidate?.card_id)
    .filter((id): id is string => id != null);
  const { totalUsd } = usePublicSparklines(ids);
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: withAlpha("#fff", 0.12),
        backgroundColor: GLASS_STRONG,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
          paddingTop: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Camera size={14} color={themed.accent.mint} strokeWidth={2.2} />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
            This session
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {matched.length}/{items.length} matched
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {totalUsd != null ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5 }}>
              <Text
                style={{
                  color: "rgba(255,255,255,0.48)",
                  fontSize: 9,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                }}
              >
                TOTAL
              </Text>
              <Text
                style={{
                  color: themed.accent.mint,
                  fontSize: 16,
                  fontWeight: "900",
                  fontVariant: ["tabular-nums"],
                  letterSpacing: -0.3,
                }}
              >
                {formatUsd(totalUsd)}
              </Text>
            </View>
          ) : null}
          {slotsLeft != null && slotsLeft <= 10 ? (
            /* Free-tier vault slots — warn before the cap bites the batch. */
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: withAlpha(
                  slotsLeft === 0 ? themed.accent.rose : themed.accent.amber,
                  0.16,
                ),
              }}
            >
              <Text
                style={{
                  color: slotsLeft === 0 ? themed.accent.rose : themed.accent.amber,
                  fontSize: 10,
                  fontWeight: "800",
                  letterSpacing: 0.4,
                }}
              >
                {slotsLeft === 0 ? "VAULT FULL" : `${slotsLeft} SLOTS LEFT`}
              </Text>
            </View>
          ) : null}
          {onAddAll ? (
            <Pressable
              onPress={onAddAll}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Add all ${addAllCount} matched cards to your vault`}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: themed.accent.mint,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Plus size={13} color="#08110D" strokeWidth={3} />
              <Text style={{ color: "#08110D", fontWeight: "900", fontSize: 12 }}>
                Add all{addAllCount > 1 ? ` · ${addAllCount}` : ""}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 10,
          paddingVertical: 10,
          gap: 10,
          alignItems: "stretch",
        }}
      >
        {items.map((item, index) => (
          <ScanSessionCard
            key={item.id}
            item={item}
            index={index}
            themed={themed}
            onPick={onPick}
            onRemove={onRemove}
            onSearchManually={onSearchManually}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ScanSessionCard({
  item,
  index,
  themed,
  onPick,
  onRemove,
  onSearchManually,
}: {
  item: ScanSessionItem;
  index: number;
  themed: ReturnType<typeof useThemedPalette>;
  onPick: (item: ScanSessionItem) => void;
  onRemove: (id: string) => void;
  onSearchManually?: () => void;
}) {
  const formatUsd = useCompactUsd();
  const matched = item.status === "matched" && item.candidate != null;
  const missed = item.status === "missed";
  const confidencePct = item.confidence != null ? Math.round(item.confidence * 100) : null;
  const title = matched
    ? item.candidate?.name ?? "Matched card"
    : missed
      ? "Couldn’t read this card"
      : "Identifying…";
  // Server-composed enrichment: price + whether the user already owns it —
  // identical numbers on web/mobile because the backend computes them.
  const price = matched ? item.candidate?.market_price_usd ?? null : null;
  const copies = matched ? item.candidate?.copies_owned ?? 0 : 0;
  const slabs = matched ? item.candidate?.graded_copies ?? 0 : 0;
  // A missed capture must never be a dead end — tapping it opens manual
  // search (the Collectr "Tap here to search manually" affordance).
  const subtitle = matched
    ? [
        price != null ? formatUsd(price) : `${confidencePct ?? 0}% match`,
        copies > 0
          ? `Own ×${copies}${slabs > 0 ? ` (${slabs} graded)` : ""}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : missed
      ? onSearchManually
        ? "Tap to search manually"
        : "Try another angle"
      : "Photo captured";

  return (
    <Pressable
      onPress={
        matched
          ? () => onPick(item)
          : missed && onSearchManually
            ? onSearchManually
            : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={
        matched
          ? `Open scanned card ${title}`
          : missed && onSearchManually
            ? "No match found. Search the catalog manually."
            : `Captured scan ${index + 1}`
      }
      style={({ pressed }) => ({
        width: 190,
        minHeight: 76,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 9,
        borderRadius: 16,
        backgroundColor: matched ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: matched
          ? withAlpha(themed.accent.mint, 0.28)
          : missed
            ? withAlpha(themed.accent.amber, 0.3)
            : withAlpha("#fff", 0.08),
        opacity: pressed && (matched || (missed && onSearchManually)) ? 0.76 : 1,
      })}
    >
      <View
        style={{
          width: 42,
          aspectRatio: 2.5 / 3.5,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          borderColor: withAlpha("#fff", 0.08),
        }}
      >
        {matched && item.candidate ? (
          <CandidateCardImage
            candidate={item.candidate}
            variant="thumb"
            rounded={8}
            priority="normal"
          />
        ) : (
          <Image
            source={{ uri: item.photoUri }}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: matched
                ? themed.accent.mint
                : item.status === "missed"
                  ? themed.accent.amber
                  : themed.accent.blue,
            }}
          />
          <Text
            style={{
              color: "rgba(255,255,255,0.54)",
              fontSize: 9,
              fontWeight: "900",
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {matched ? "Scanned" : item.status === "missed" ? "No match" : "Reading"}
          </Text>
        </View>
        <Text numberOfLines={2} style={{ color: "#fff", fontSize: 12.5, fontWeight: "800" }}>
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            color:
              missed && onSearchManually
                ? themed.accent.mint
                : "rgba(255,255,255,0.52)",
            fontSize: 10.5,
            fontWeight: missed && onSearchManually ? "800" : "600",
          }}
        >
          {subtitle}
        </Text>
      </View>

      <Pressable
        onPress={() => onRemove(item.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove captured scan ${index + 1}`}
        style={{
          position: "absolute",
          top: 5,
          right: 5,
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.48)",
        }}
      >
        <X size={12} color="rgba(255,255,255,0.88)" />
      </Pressable>
    </Pressable>
  );
}
