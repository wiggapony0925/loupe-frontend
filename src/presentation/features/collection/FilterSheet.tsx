/**
 * FilterSheet — the Vault's full filter surface in a half-screen bottom sheet.
 *
 * Drill-down list flow (Instagram style). Uses the app's dark theme tokens.
 * Active filters shown as removable mint tags above the footer.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowDownAZ,
  Award,
  DollarSign,
  Tag,
  Layers,
  TrendingUp,
  TrendingDown,
} from "lucide-react-native";
import { useFilterMetadata } from "@/application/queries";
import {
  useVaultFilters,
  activeFilterCount,
  type VaultSort,
  type VaultType,
} from "@/application/stores/vaultStore";
import {
  radius,
  spacing,
  useThemedPalette,
  withAlpha,
} from "@/presentation/theme/tokens";

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
  resultCount: number;
  isCountFetching?: boolean;
}

type FilterStep = "main" | "sort" | "house" | "minGrade" | "maxGrade" | "price" | "tags" | "sets";

/** The shape we read from the vault filter store for tag building. */
interface VaultFilterSnapshot {
  sort: VaultSort;
  houses: VaultType[];
  gradeRange: [number, number];
  minValue: number | null;
  maxValue: number | null;
  tags: string[];
  sets: string[];
  setSort: (s: VaultSort) => void;
  toggleHouse: (h: VaultType) => void;
  setGradeRange: (r: [number, number]) => void;
  setValueRange: (min: number | null, max: number | null) => void;
  toggleTag: (t: string) => void;
  toggleSet: (s: string) => void;
}

function buildActiveFilters(
  s: VaultFilterSnapshot,
  sorts: { key: string; label: string }[],
  housesList: { key: string; label: string }[],
  priceBands: { label: string; min: number | null; max: number | null }[],
): { key: string; label: string; onRemove: () => void }[] {
  const filters: { key: string; label: string; onRemove: () => void }[] = [];

  if (s.sort !== "recent") {
    const label = sorts.find((o) => o.key === s.sort)?.label ?? s.sort;
    filters.push({ key: "sort", label: `Sort: ${label}`, onRemove: () => s.setSort("recent") });
  }

  for (const h of s.houses) {
    const label = housesList.find((o) => o.key === h)?.label ?? h;
    filters.push({ key: `house-${h}`, label, onRemove: () => s.toggleHouse(h) });
  }

  if (s.gradeRange[0] > 1) {
    filters.push({ key: "minGrade", label: `≥ ${s.gradeRange[0]}`, onRemove: () => s.setGradeRange([1, s.gradeRange[1]]) });
  }

  if (s.gradeRange[1] < 10) {
    filters.push({ key: "maxGrade", label: `≤ ${s.gradeRange[1]}`, onRemove: () => s.setGradeRange([s.gradeRange[0], 10]) });
  }

  if (s.minValue != null || s.maxValue != null) {
    const band = priceBands.find((b) => b.min === s.minValue && b.max === s.maxValue);
    const label = band
      ? band.label
      : s.minValue != null && s.maxValue != null
        ? `$${s.minValue}–$${s.maxValue}`
        : s.minValue != null
          ? `$${s.minValue}+`
          : `< $${s.maxValue}`;
    filters.push({ key: "price", label, onRemove: () => s.setValueRange(null, null) });
  }

  for (const t of s.tags) {
    filters.push({ key: `tag-${t}`, label: t, onRemove: () => s.toggleTag(t) });
  }

  for (const name of s.sets) {
    filters.push({ key: `set-${name}`, label: name, onRemove: () => s.toggleSet(name) });
  }

  return filters;
}

const STEP_TITLES: Record<Exclude<FilterStep, "main">, string> = {
  sort: "Sort by",
  house: "Grading house",
  minGrade: "Min grade",
  maxGrade: "Max grade",
  price: "Price",
  tags: "Tags",
  sets: "Sets",
};

export function FilterSheet({
  visible,
  onClose,
  availableSets,
  availableTags,
  resultCount,
  isCountFetching = false,
}: FilterSheetProps) {
  const p = useThemedPalette();
  const s = useVaultFilters();
  const count = activeFilterCount(s);
  const [step, setStep] = useState<FilterStep>("main");
  const [setQuery, setSetQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");

  // Call hook to get filtering options metadata from the backend
  const metaQuery = useFilterMetadata();
  const meta = metaQuery.data;

  // Use backend metadata or default fallbacks
  const sorts = meta?.sorts ?? SORTS;
  const housesList = meta?.houses ?? HOUSES;
  const priceBands = meta?.priceBands ?? PRICE_BANDS;
  const minGrades = meta?.minGrades ?? MIN_GRADES;
  const maxGrades = meta?.maxGrades ?? MAX_GRADES;

  const [customMin, setCustomMin] = useState(s.minValue != null ? String(s.minValue) : "");
  const [customMax, setCustomMax] = useState(s.maxValue != null ? String(s.maxValue) : "");

  const gradeLabel = (g: number) => (g === 1 ? "Any" : g === 10 ? "10" : String(g));
  const priceActive = (min: number | null, max: number | null) =>
    s.minValue === min && s.maxValue === max;

  const activeFilters = useMemo(() => buildActiveFilters(s, sorts, housesList, priceBands), [s, sorts, housesList, priceBands]);

  const filteredSets = useMemo(() => {
    const q = setQuery.trim().toLowerCase();
    if (!q) return availableSets;
    return availableSets.filter((name) => name.toLowerCase().includes(q));
  }, [availableSets, setQuery]);

  const filteredTags = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return availableTags;
    return availableTags.filter((tag) => tag.toLowerCase().includes(q));
  }, [availableTags, tagQuery]);

  const handleSelectPriceBand = (min: number | null, max: number | null) => {
    s.setValueRange(min, max);
    setCustomMin(min != null ? String(min) : "");
    setCustomMax(max != null ? String(max) : "");
  };

  const handleClose = () => {
    setStep("main");
    setSetQuery("");
    setTagQuery("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={handleClose}
      animationType="slide"
      // Force transparent overlay on BOTH platforms so the sheet uses our
      // dark theme instead of iOS's system-white pageSheet chrome.
      presentationStyle="overFullScreen"
      transparent
    >
      {/* Dimmed backdrop — tap to dismiss */}
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
        <Pressable style={{ flex: 1 }} onPress={handleClose} />

        {/* Sheet container — half screen */}
        <SafeAreaView
          edges={["bottom"]}
          style={{
            maxHeight: "58%",
            backgroundColor: p.bg.base,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingTop: spacing.sm + 2, paddingBottom: spacing.xs }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: withAlpha(p.ink.muted, 0.25),
              }}
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xs,
              paddingBottom: spacing.md,
            }}
          >
            {step === "main" ? (
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: 22,
                  fontWeight: "900",
                  letterSpacing: -0.5,
                }}
              >
                Filters
              </Text>
            ) : (
              <Pressable
                onPress={() => setStep("main")}
                hitSlop={10}
                style={{ flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -4 }}
              >
                <ChevronLeft size={22} color={p.accent.mint} />
                <Text
                  style={{
                    color: p.ink.default,
                    fontSize: 18,
                    fontWeight: "800",
                    letterSpacing: -0.3,
                  }}
                >
                  {STEP_TITLES[step]}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(p.ink.muted, 0.12),
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <X size={14} color={p.ink.muted} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* Scrollable list content */}
          <ScrollView
            style={{ flexGrow: 1, flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.md }}
          >
            {step === "main" && (
              <>
                <MenuRow icon={ArrowDownAZ} label="Sort by" tint={p.accent.blue} onPress={() => setStep("sort")} />
                <MenuRow icon={Award} label="Grading house" tint={p.accent.amber} onPress={() => setStep("house")} />
                <MenuRow icon={TrendingUp} label="Min grade" tint={p.accent.mint} onPress={() => setStep("minGrade")} />
                <MenuRow icon={TrendingDown} label="Max grade" tint={p.accent.rose} onPress={() => setStep("maxGrade")} />
                <MenuRow icon={DollarSign} label="Price" tint={p.accent.mint} onPress={() => setStep("price")} />
                {availableTags.length > 0 && <MenuRow icon={Tag} label="Tags" tint={p.accent.blue} onPress={() => setStep("tags")} />}
                {availableSets.length > 1 && <MenuRow icon={Layers} label="Sets" tint={p.accent.amber} onPress={() => setStep("sets")} />}
              </>
            )}

            {step === "sort" && sorts.map((o) => (
              <OptionRow key={o.key} label={o.label} selected={s.sort === o.key} onPress={() => s.setSort(o.key as any)} />
            ))}

            {step === "house" && housesList.map((h) => (
              <OptionRow key={h.key} label={h.label} selected={s.houses.includes(h.key as any)} onPress={() => s.toggleHouse(h.key as any)} />
            ))}

            {step === "minGrade" && minGrades.map((g) => (
              <OptionRow key={g} label={g === 1 ? "Any" : `≥ ${gradeLabel(g)}`} selected={s.gradeRange[0] === g} onPress={() => s.setGradeRange([g, Math.max(g, s.gradeRange[1])])} />
            ))}

            {step === "maxGrade" && maxGrades.map((g) => (
              <OptionRow key={g} label={g === 10 ? "Any" : `≤ ${gradeLabel(g)}`} selected={s.gradeRange[1] === g} onPress={() => s.setGradeRange([Math.min(g, s.gradeRange[0]), g])} />
            ))}

            {step === "price" && (
              <View>
                {priceBands.map((b) => (
                  <OptionRow
                    key={b.label}
                    label={b.label}
                    selected={b.min === null && b.max === null ? s.minValue == null && s.maxValue == null : priceActive(b.min, b.max)}
                    onPress={() => handleSelectPriceBand(b.min, b.max)}
                  />
                ))}

                <View
                  style={{
                    paddingHorizontal: spacing.xl,
                    paddingTop: spacing.md,
                    paddingBottom: spacing.sm,
                    gap: 10,
                  }}
                >
                  <Text style={{ color: p.ink.muted, fontSize: 13, fontWeight: "700" }}>
                    Custom range
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: withAlpha(p.ink.muted, 0.08),
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        height: 44,
                      }}
                    >
                      <Text style={{ color: p.ink.dim, fontSize: 14, fontWeight: "600", marginRight: 4 }}>$</Text>
                      <TextInput
                        placeholder="Min"
                        placeholderTextColor={p.ink.dim}
                        keyboardType="numeric"
                        value={customMin}
                        onChangeText={(t) => {
                          setCustomMin(t);
                          const parsed = t.trim() ? parseFloat(t) : null;
                          s.setValueRange(isNaN(parsed as number) ? null : parsed, s.maxValue);
                        }}
                        style={{ flex: 1, color: p.ink.default, fontSize: 14, fontWeight: "600", paddingVertical: 0 }}
                      />
                    </View>
                    <Text style={{ color: p.ink.dim, fontSize: 14 }}>to</Text>
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: withAlpha(p.ink.muted, 0.08),
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        height: 44,
                      }}
                    >
                      <Text style={{ color: p.ink.dim, fontSize: 14, fontWeight: "600", marginRight: 4 }}>$</Text>
                      <TextInput
                        placeholder="Max"
                        placeholderTextColor={p.ink.dim}
                        keyboardType="numeric"
                        value={customMax}
                        onChangeText={(t) => {
                          setCustomMax(t);
                          const parsed = t.trim() ? parseFloat(t) : null;
                          s.setValueRange(s.minValue, isNaN(parsed as number) ? null : parsed);
                        }}
                        style={{ flex: 1, color: p.ink.default, fontSize: 14, fontWeight: "600", paddingVertical: 0 }}
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {step === "tags" && (
              <>
                <StepSearchInput
                  value={tagQuery}
                  onChangeText={setTagQuery}
                  placeholder="Search tags…"
                />
                {filteredTags.length === 0 ? (
                  <Text
                    style={{
                      color: p.ink.muted,
                      fontSize: 13,
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.md,
                    }}
                  >
                    No tags match.
                  </Text>
                ) : (
                  filteredTags.map((t) => (
                    <OptionRow
                      key={t}
                      label={t}
                      selected={s.tags.includes(t)}
                      onPress={() => s.toggleTag(t)}
                    />
                  ))
                )}
              </>
            )}

            {step === "sets" && (
              <>
                <StepSearchInput
                  value={setQuery}
                  onChangeText={setSetQuery}
                  placeholder="Search sets…"
                />
                {filteredSets.length === 0 ? (
                  <Text
                    style={{
                      color: p.ink.muted,
                      fontSize: 13,
                      paddingHorizontal: spacing.xl,
                      paddingVertical: spacing.md,
                    }}
                  >
                    No sets match.
                  </Text>
                ) : (
                  filteredSets.map((name) => (
                    <OptionRow
                      key={name}
                      label={name}
                      selected={s.sets.includes(name)}
                      onPress={() => s.toggleSet(name)}
                    />
                  ))
                )}
              </>
            )}
          </ScrollView>

          {/* Active filter tags — removable mint pills */}
          {step === "main" && activeFilters.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: spacing.xl,
                gap: 8,
                paddingVertical: spacing.sm,
              }}
            >
              {activeFilters.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={f.onRemove}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${f.label}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      paddingLeft: 12,
                      paddingRight: 8,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: withAlpha(p.accent.mint, 0.15),
                    }}
                  >
                    <Text style={{ color: p.accent.mint, fontSize: 12.5, fontWeight: "700" }}>
                      {f.label}
                    </Text>
                    <X size={11} color={p.accent.mint} strokeWidth={2.5} />
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Footer buttons */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.sm,
              paddingBottom: Platform.OS === "ios" ? spacing.sm : spacing.lg,
            }}
          >
            <Pressable
              onPress={s.clearAll}
              disabled={count === 0}
              accessibilityLabel="Clear all filters"
              style={({ pressed }) => ({
                paddingHorizontal: spacing.xl,
                height: 48,
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: withAlpha(p.ink.muted, 0.1),
                opacity: count === 0 ? 0.3 : pressed ? 0.65 : 1,
              })}
            >
              <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>
                Clear
              </Text>
            </Pressable>
            <Pressable
              onPress={handleClose}
              accessibilityLabel={`Show ${resultCount} results`}
              style={({ pressed }) => ({
                flex: 1,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: p.accent.mint,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              {isCountFetching ? (
                <ActivityIndicator color="#06140d" />
              ) : (
                <Text style={{ color: "#06140d", fontSize: 14, fontWeight: "800" }}>
                  Show {resultCount} {resultCount === 1 ? "card" : "cards"}
                </Text>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/* ─── Row primitives ─────────────────────────────────────────────────── */

function StepSearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const p = useThemedPalette();
  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.ink.dim}
        autoCorrect={false}
        autoCapitalize="none"
        style={{
          height: 40,
          borderRadius: 12,
          paddingHorizontal: 14,
          backgroundColor: withAlpha(p.ink.default, 0.06),
          color: p.ink.default,
          fontSize: 14,
          fontWeight: "600",
        }}
      />
    </View>
  );
}

function MenuRow({
  icon: Icon,
  label,
  tint,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.xl,
          paddingVertical: 14,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(tint, 0.12),
            marginRight: spacing.md,
          }}
        >
          <Icon size={17} color={tint} />
        </View>
        <Text style={{ flex: 1, color: p.ink.default, fontSize: 15.5, fontWeight: "600" }}>
          {label}
        </Text>
        <ChevronRight size={16} color={withAlpha(p.ink.muted, 0.5)} />
      </View>
    </Pressable>
  );
}

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useThemedPalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.xl,
          paddingVertical: 14,
        }}
      >
        <Text
          style={{
            flex: 1,
            color: selected ? p.ink.default : p.ink.muted,
            fontSize: 15.5,
            fontWeight: selected ? "700" : "500",
          }}
        >
          {label}
        </Text>
        {selected && <Check size={17} color={p.accent.mint} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}
