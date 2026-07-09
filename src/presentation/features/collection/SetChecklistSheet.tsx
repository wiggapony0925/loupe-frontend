/**
 * `SetChecklistSheet` — tap a set-progress tile → the full "have vs missing"
 * checklist for that set, as a bottom sheet.
 *
 *   ┌──────────────────────────────────────────┐
 *   │ SET · Base Set                        ✕  │
 *   │ 6 / 102 collected     ▓▓░░░░░░░░  5.9%    │
 *   ├──────────────────────────────────────────┤
 *   │ IN YOUR COLLECTION · 6                    │
 *   │  🖼  Charizard        #4                ✓ │
 *   │  …                                        │
 *   │ STILL MISSING · 96                        │
 *   │  🖼  Alakazam (dimmed) #1               ＋ │  ← still tappable
 *   └──────────────────────────────────────────┘
 *
 * The complete list + owned flags come from `/v1/sets/{set_id}/checklist`;
 * missing rows are dimmed but fully interactive (tap → card detail so the
 * user can go buy/scan it). Mirrors `PortfolioPickerSheet`'s RN-`Modal`
 * pageSheet presentation so it feels native on iOS.
 */

import React, { useMemo } from "react";
import { Modal, Platform, Pressable, SectionList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Check, Plus, X } from "lucide-react-native";
import { useSetChecklist } from "@/application/queries/catalog/useSetChecklist";
import { routes } from "@/shared/routes";
import { CardImage } from "@/presentation/components/CardImage";
import { Skeleton } from "@/presentation/components/Skeleton";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import type { SetChecklistCardWire } from "@/infrastructure/http";

interface SetChecklistSheetProps {
  visible: boolean;
  onClose: () => void;
  setId: string | null;
  /** Shown in the header immediately, before the checklist resolves. */
  setName?: string | null;
}

const THUMB_W = 46;
const THUMB_H = 64;

function ringTint(percent: number): string {
  if (percent >= 75) return palette.accent.mint;
  if (percent >= 25) return palette.accent.amber;
  return palette.accent.rose;
}

export function SetChecklistSheet({ visible, onClose, setId, setName }: SetChecklistSheetProps) {
  const p = useThemedPalette();
  const { data, isLoading } = useSetChecklist(setId, visible);

  const owned = data?.owned ?? 0;
  const total = data?.total ?? 0;
  const percent = total > 0 ? (owned / total) * 100 : 0;
  const tint = ringTint(percent);
  const title = data?.setName ?? setName ?? "Set";

  const sections = useMemo(() => {
    const cards = data?.cards ?? [];
    const have = cards.filter((c) => c.owned);
    const missing = cards.filter((c) => !c.owned);
    const out: { key: string; title: string; count: number; data: SetChecklistCardWire[] }[] = [];
    if (have.length) {
      out.push({ key: "owned", title: "In your collection", count: have.length, data: have });
    }
    if (missing.length) {
      out.push({ key: "missing", title: "Still missing", count: missing.length, data: missing });
    }
    return out;
  }, [data]);

  const openCard = (id: string) => {
    onClose();
    // Defer so the sheet dismiss animation and the push don't fight.
    requestAnimationFrame(() => router.push(routes.card(id)));
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"}
      transparent={Platform.OS !== "ios"}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: Platform.OS === "ios" ? p.bg.base : "rgba(0,0,0,0.45)",
          justifyContent: Platform.OS === "ios" ? "flex-start" : "flex-end",
        }}
      >
        {Platform.OS !== "ios" ? <Pressable style={{ flex: 1 }} onPress={onClose} /> : null}

        <SafeAreaView
          edges={Platform.OS === "ios" ? ["top"] : ["bottom"]}
          style={{
            backgroundColor: p.bg.base,
            borderTopLeftRadius: Platform.OS === "ios" ? 0 : 24,
            borderTopRightRadius: Platform.OS === "ios" ? 0 : 24,
            maxHeight: Platform.OS === "ios" ? undefined : "88%",
            flex: Platform.OS === "ios" ? 1 : undefined,
          }}
        >
          {Platform.OS !== "ios" ? (
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: p.line.default,
                }}
              />
            </View>
          ) : null}

          {/* Header */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    color: p.ink.dim,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 3,
                    textTransform: "uppercase",
                  }}
                >
                  Set
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    color: p.ink.default,
                    fontSize: 22,
                    fontWeight: "800",
                    letterSpacing: -0.4,
                    marginTop: 2,
                  }}
                >
                  {title}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close set checklist"
                style={{
                  height: 36,
                  width: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: p.line.default,
                  backgroundColor: p.bg.elevated,
                }}
              >
                <X size={16} color={p.ink.muted} />
              </Pressable>
            </View>

            {/* Progress */}
            <View style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>
                  {owned}{" "}
                  <Text style={{ color: p.ink.dim, fontWeight: "600" }}>/ {total} collected</Text>
                </Text>
                <Text
                  style={{
                    color: tint,
                    fontSize: 14,
                    fontWeight: "800",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {percent.toFixed(percent < 10 ? 1 : 0)}%
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: withAlpha(tint, 0.16),
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, percent))}%`,
                    backgroundColor: tint,
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>
          </View>

          {isLoading && !data ? (
            <View style={{ paddingHorizontal: 20, gap: 12, paddingTop: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Skeleton width={THUMB_W} height={THUMB_H} radius={8} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <Skeleton width={"55%"} height={14} radius={4} />
                    <Skeleton width={"28%"} height={10} radius={4} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
              showsVerticalScrollIndicator={false}
              renderSectionHeader={({ section }) => (
                <View style={{ paddingTop: 18, paddingBottom: 8, backgroundColor: p.bg.base }}>
                  <Text
                    style={{
                      color: p.ink.dim,
                      fontSize: 11,
                      fontWeight: "800",
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {section.title}{" "}
                    <Text style={{ color: withAlpha(p.ink.dim, 0.7) }}>· {section.count}</Text>
                  </Text>
                </View>
              )}
              renderItem={({ item }) => (
                <ChecklistRow item={item} onPress={() => openCard(item.id)} p={p} />
              )}
              ListEmptyComponent={
                <View style={{ paddingTop: 48, alignItems: "center" }}>
                  <Text style={{ color: p.ink.dim, fontSize: 14 }}>
                    No cards to show for this set yet.
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function ChecklistRow({
  item,
  onPress,
  p,
}: {
  item: SetChecklistCardWire;
  onPress: () => void;
  p: ReturnType<typeof useThemedPalette>;
}) {
  const missing = !item.owned;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.number ? `, number ${item.number}` : ""}, ${missing ? "not owned" : "owned"}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
        opacity: missing ? (pressed ? 0.6 : 0.46) : pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: THUMB_W,
          height: THUMB_H,
          borderRadius: 8,
          overflow: "hidden",
          backgroundColor: p.bg.sunken,
        }}
      >
        <CardImage
          uri={item.imageUrl}
          width={THUMB_W}
          height={THUMB_H}
          rounded={0}
          contentFit="cover"
          priority="low"
          recyclingKey={item.id}
          alt={item.name}
        />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ color: p.ink.default, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }}
        >
          {item.name}
        </Text>
        {item.number ? (
          <Text style={{ color: p.ink.muted, fontSize: 12 }}>#{item.number}</Text>
        ) : null}
      </View>

      {/* Owned → mint check; missing → hollow plus (go add it). */}
      {missing ? (
        <View
          style={{
            height: 26,
            width: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <Plus size={14} color={p.ink.muted} strokeWidth={2.4} />
        </View>
      ) : (
        <View
          style={{
            height: 26,
            width: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(p.accent.mint, 0.16),
          }}
        >
          <Check size={15} color={p.accent.mint} strokeWidth={3} />
        </View>
      )}
    </Pressable>
  );
}
