/**
 * FilterSheet — the Vault's full filter surface in a slide-up modal.
 *
 * Multi-select grading house, grade window, sets, tags, price band, and sort —
 * all wired straight to the vault filter store, so the holdings list (and the
 * "Show N results" footer) update live as the user taps. Uses a plain RN
 * `Modal` (the project has no bottom-sheet dep yet — same pattern as
 * `PriceAlertSheet`). House style: tap = do it, no confirm popups.
 */
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { X } from "lucide-react-native";
import {
  useVaultFilters,
  activeFilterCount,
  type VaultSort,
  type VaultType,
} from "@/application/stores/vaultStore";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const HOUSES: { key: VaultType; label: string }[] = [
  { key: "loupe", label: "Loupe" },
  { key: "raw", label: "Raw" },
  { key: "psa", label: "PSA" },
  { key: "bgs", label: "BGS" },
  { key: "cgc", label: "CGC" },
  { key: "sgc", label: "SGC" },
];

const SORTS: { key: VaultSort; label: string }[] = [
  { key: "recent", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "value_desc", label: "Value ↓" },
  { key: "value_asc", label: "Value ↑" },
  { key: "grade_desc", label: "Grade ↓" },
  { key: "grade_asc", label: "Grade ↑" },
];

const MIN_GRADES = [1, 7, 8, 9, 9.5, 10];
const MAX_GRADES = [10, 9.5, 9, 8];

// Price bands → [min, max] (null = open-ended).
const PRICE_BANDS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Any", min: null, max: null },
  { label: "< $25", min: null, max: 25 },
  { label: "$25–100", min: 25, max: 100 },
  { label: "$100–500", min: 100, max: 500 },
  { label: "$500+", min: 500, max: null },
];

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  availableSets: string[];
  availableTags: string[];
  /** Live count of matching holdings, shown on the footer button. */
  resultCount: number;
}

export function FilterSheet({
  visible,
  onClose,
  availableSets,
  availableTags,
  resultCount,
}: FilterSheetProps) {
  const p = useThemedPalette();
  const s = useVaultFilters();
  const count = activeFilterCount(s);

  const gradeLabel = (g: number) => (g === 1 ? "Any" : g === 10 ? "10" : String(g));
  const priceActive = (min: number | null, max: number | null) =>
    s.minValue === min && s.maxValue === max;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
      >
        <View style={{ flex: 1 }} />
      </Pressable>
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "88%",
          backgroundColor: p.bg.elevated,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: p.line.default,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 8,
          }}
        >
          <Text style={{ color: p.ink.default, fontSize: 18, fontWeight: "800" }}>
            Filters{count > 0 ? ` · ${count}` : ""}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close filters">
            <X size={22} color={p.ink.muted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 10, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Section label="Sort by">
            {SORTS.map((o) => (
              <Chip
                key={o.key}
                label={o.label}
                active={s.sort === o.key}
                onPress={() => s.setSort(o.key)}
              />
            ))}
          </Section>

          <Section label="Grading house">
            {HOUSES.map((h) => (
              <Chip
                key={h.key}
                label={h.label}
                active={s.houses.includes(h.key)}
                onPress={() => s.toggleHouse(h.key)}
              />
            ))}
          </Section>

          <Section label="Min grade">
            {MIN_GRADES.map((g) => (
              <Chip
                key={g}
                label={g === 1 ? "Any" : `≥ ${gradeLabel(g)}`}
                active={s.gradeRange[0] === g}
                onPress={() =>
                  s.setGradeRange([g, Math.max(g, s.gradeRange[1])])
                }
              />
            ))}
          </Section>

          <Section label="Max grade">
            {MAX_GRADES.map((g) => (
              <Chip
                key={g}
                label={g === 10 ? "Any" : `≤ ${gradeLabel(g)}`}
                active={s.gradeRange[1] === g}
                onPress={() =>
                  s.setGradeRange([Math.min(g, s.gradeRange[0]), g])
                }
              />
            ))}
          </Section>

          <Section label="Price">
            {PRICE_BANDS.map((b) => (
              <Chip
                key={b.label}
                label={b.label}
                active={
                  b.min === null && b.max === null
                    ? s.minValue == null && s.maxValue == null
                    : priceActive(b.min, b.max)
                }
                onPress={() => s.setValueRange(b.min, b.max)}
              />
            ))}
          </Section>

          {availableTags.length > 0 ? (
            <Section label="Tags">
              {availableTags.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  tint={p.accent.mint}
                  active={s.tags.includes(t)}
                  onPress={() => s.toggleTag(t)}
                />
              ))}
            </Section>
          ) : null}

          {availableSets.length > 1 ? (
            <Section label="Set">
              {availableSets.map((name) => (
                <Chip
                  key={name}
                  label={name.length > 22 ? `${name.slice(0, 21)}…` : name}
                  active={s.sets.includes(name)}
                  onPress={() => s.toggleSet(name)}
                />
              ))}
            </Section>
          ) : null}
        </ScrollView>

        {/* Footer: clear all + show results */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 30,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: p.line.default,
          }}
        >
          <Pressable
            onPress={s.clearAll}
            disabled={count === 0}
            accessibilityLabel="Clear all filters"
            style={({ pressed }) => ({
              paddingHorizontal: 18,
              height: 48,
              justifyContent: "center",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: p.line.default,
              opacity: count === 0 ? 0.4 : pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>
              Clear all
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityLabel={`Show ${resultCount} results`}
            style={({ pressed }) => ({
              flex: 1,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              backgroundColor: p.accent.mint,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#06140d", fontSize: 15, fontWeight: "800" }}>
              Show {resultCount} {resultCount === 1 ? "card" : "cards"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const p = useThemedPalette();
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          color: p.ink.dim,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {children}
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  tint,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  tint?: string;
}) {
  const p = useThemedPalette();
  const accent = tint ?? p.accent.blue;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? withAlpha(accent, 0.55) : p.line.default,
        backgroundColor: active ? withAlpha(accent, 0.14) : p.bg.base,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: active ? accent : p.ink.muted,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
