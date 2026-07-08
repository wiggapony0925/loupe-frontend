/**
 * GradeForm — reusable form for adding a card to the vault manually
 * and for editing an existing holding.
 *
 * The same form is used by two screens:
 *   • `/grade/new?cardId=…|upstreamId=…` — POST /v1/grades
 *   • `/grade/[id]`                       — PATCH /v1/grades/{id}
 *
 * Field set mirrors the web CollectionForm + backend `app/schemas/grade.py`:
 *   grade · house · condition (raw) · copies · purchase price ·
 *   purchase date · estimated value · notes
 *
 * Card identity is shown read-only at the top (thumbnail · title · set /
 * year); the form does not let the user re-pick the card once it's bound.
 * For a true "I don't know which card this is yet" flow, send them
 * through the search screen first.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronLeft, Trash2 } from "lucide-react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import { useMoney } from "@/presentation/components/Price";
import { TagInput } from "@/presentation/features/collection/TagInput";
import { fetchCollectionSummary } from "@/infrastructure/repositories/forensicRepository";
import { queryKeys } from "@/application/queries/queryKeys";
import {
  useCreateGrade,
  useDeleteGrade,
  useUpdateGrade,
} from "@/application/queries";
import { useCardMarket } from "@/application/queries/catalog/useCardMarket";
import { ApiError } from "@/infrastructure/http/client";
import { usePro } from "@/presentation/features/pro";
import type { GradeHouse, RawCondition } from "@/infrastructure/http";
import { palette, useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

/** Houses surfaced in the segmented control. Order matches the rest of the app. */
const HOUSES: { id: GradeHouse; label: string }[] = [
  { id: "psa", label: "PSA" },
  { id: "bgs", label: "BGS" },
  { id: "sgc", label: "SGC" },
  { id: "cgc", label: "CGC" },
  { id: "tag", label: "TAG" },
  { id: "loupe", label: "RAW" },
];

/**
 * Condition vocabulary for RAW (ungraded) cards. Mirrors the standard
 * PSA / TCG vocabulary so per-condition pricing maps directly. Only
 * surfaced when the user selects `RAW` as the grading house.
 */
const CONDITIONS: { id: RawCondition; label: string; short: string }[] = [
  { id: "nm", short: "NM", label: "Near Mint" },
  { id: "lp", short: "LP", label: "Lightly Played" },
  { id: "mp", short: "MP", label: "Moderately Played" },
  { id: "hp", short: "HP", label: "Heavily Played" },
  { id: "dmg", short: "DMG", label: "Damaged" },
];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface GradeFormCardMeta {
  /** Local catalog UUID. One of cardId/upstreamId must be set on create. */
  cardId?: string | null;
  /** Composite upstream id (e.g. `pokemontcg:base1-4`). */
  upstreamId?: string | null;
  name: string | null;
  imageUrl: string | null;
  setName: string | null;
  year: number | null;
}

export interface GradeFormInitial {
  grade?: number;
  house?: GradeHouse;
  condition?: RawCondition | null;
  purchasePriceUsd?: number | null;
  purchaseDate?: string | null;
  estimatedValueUsd?: number | null;
  notes?: string | null;
  tags?: string[];
}

export interface GradeFormProps {
  mode: "create" | "edit";
  /** Required for `mode === "edit"`. */
  gradeId?: string;
  card: GradeFormCardMeta;
  initial?: GradeFormInitial;
}

function clampNumeric(input: string, max = 10): string {
  // Allow empty, digits, and one decimal point. No leading minus.
  const cleaned = input.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  const normalized =
    parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
  const asNum = Number(normalized);
  if (Number.isFinite(asNum) && asNum > max) return String(max);
  return normalized;
}

function clampCurrency(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length === 1) return parts[0] ?? "";
  return `${parts[0] ?? ""}.${parts.slice(1).join("").slice(0, 2)}`;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysBetween(iso: string): number | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const then = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(then)) return null;
  const now = Date.now();
  if (then > now) return null;
  return Math.floor((now - then) / 86_400_000);
}

export function GradeForm({ mode, gradeId, card, initial }: GradeFormProps) {
  const p = useThemedPalette();
  const { format: money } = useMoney();
  const { openPaywall } = usePro();
  const createMut = useCreateGrade();
  const updateMut = useUpdateGrade();
  const deleteMut = useDeleteGrade();
  // Tags the user already uses elsewhere — offered as tap-to-add suggestions.
  // Shares the vault summary cache, so it's usually already warm.
  const tagSuggestions = useQuery({
    queryKey: queryKeys.collection.summary(),
    queryFn: fetchCollectionSummary,
    staleTime: 60_000,
  });

  const [grade, setGrade] = useState<string>(
    initial?.grade != null ? String(initial.grade) : "",
  );
  const [house, setHouse] = useState<GradeHouse>(initial?.house ?? "psa");
  const [condition, setCondition] = useState<RawCondition | null>(
    initial?.condition ?? null,
  );
  const [purchasePrice, setPurchasePrice] = useState<string>(
    initial?.purchasePriceUsd != null ? String(initial.purchasePriceUsd) : "",
  );
  const [purchaseDate, setPurchaseDate] = useState<string>(
    initial?.purchaseDate ?? "",
  );
  const [estimatedValue, setEstimatedValue] = useState<string>(
    initial?.estimatedValueUsd != null ? String(initial.estimatedValueUsd) : "",
  );
  // Tracks whether the user has manually edited the estimated value
  // input. While false (create flow, untouched), the field auto-syncs
  // to the live market snapshot picked by current grade/house.
  const estValueTouchedRef = useRef<boolean>(
    mode === "edit" || initial?.estimatedValueUsd != null,
  );
  const [autoFilledFromMarket, setAutoFilledFromMarket] = useState(false);
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  // How many identical holdings to create. Create-mode only — editing a
  // single holding never changes the count. Mirrors the web CollectionForm.
  const [copies, setCopies] = useState<string>("1");
  const [submitting, setSubmitting] = useState(false);

  // Live market snapshot for the bound card. Only fetched on create —
  // edit flows already have the user's chosen value persisted.
  const marketEnabled = mode === "create" && Boolean(card.cardId);
  const marketQ = useCardMarket(marketEnabled ? card.cardId : null);
  const marketSummary = marketQ.data?.snapshot?.summary;

  // Pick the right headline from the snapshot for the user's current
  // grade selection. RAW → raw; high grade (>= 8) → pop_top (top tier);
  // anything else → graded_avg. Falls back across the trio so we always
  // surface *something* when the snapshot has any pricing.
  const suggestedEstimate = useMemo<number | null>(() => {
    if (!marketSummary) return null;
    const raw = marketSummary.raw?.amount ?? null;
    const top = marketSummary.pop_top?.amount ?? null;
    const avg = marketSummary.graded_avg?.amount ?? null;
    if (house === "loupe") return raw ?? avg ?? top;
    const gNum = Number(grade);
    if (Number.isFinite(gNum) && gNum >= 8) return top ?? avg ?? raw;
    return avg ?? top ?? raw;
  }, [marketSummary, house, grade]);

  useEffect(() => {
    if (estValueTouchedRef.current) return;
    if (suggestedEstimate == null) return;
    setEstimatedValue(suggestedEstimate.toFixed(2));
    setAutoFilledFromMarket(true);
  }, [suggestedEstimate]);

  const heldDays = useMemo(() => daysBetween(purchaseDate), [purchaseDate]);
  const dateValid = purchaseDate === "" || ISO_DATE_RE.test(purchaseDate);
  const gradeNum = Number(grade);
  const gradeValid =
    grade !== "" && Number.isFinite(gradeNum) && gradeNum >= 0 && gradeNum <= 10;

  const canSubmit =
    !submitting &&
    gradeValid &&
    dateValid &&
    (mode === "edit" || Boolean(card.cardId || card.upstreamId));

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (mode === "create") {
        const payload = {
          cardId: card.cardId ?? null,
          upstreamId: card.upstreamId ?? null,
          grade: gradeNum,
          house,
          condition: house === "loupe" ? condition : null,
          purchasePriceUsd: purchasePrice === "" ? null : Number(purchasePrice),
          purchaseDate: purchaseDate || null,
          estimatedValueUsd:
            estimatedValue === "" ? null : Number(estimatedValue),
          notes: notes.trim() || null,
          tags,
        };
        // One row per copy — the backend models copies as distinct holdings,
        // so we POST once each (mirrors the web CollectionForm).
        const count = Math.max(1, Math.min(99, parseInt(copies, 10) || 1));
        for (let i = 0; i < count; i++) {
          await createMut.mutateAsync(payload);
        }
      } else if (mode === "edit" && gradeId) {
        await updateMut.mutateAsync({
          id: gradeId,
          grade: gradeNum,
          house,
          condition: house === "loupe" ? condition : null,
          purchasePriceUsd: purchasePrice === "" ? null : Number(purchasePrice),
          purchaseDate: purchaseDate || null,
          estimatedValueUsd:
            estimatedValue === "" ? null : Number(estimatedValue),
          notes: notes.trim() || null,
          tags,
        });
      }
      router.back();
    } catch (e) {
      // Free-tier cap reached — turn the 402 into the upgrade paywall
      // rather than a dead-end error (mirrors the web CollectionForm).
      if (e instanceof ApiError && e.status === 402) {
        openPaywall("card_limit");
        return;
      }
      Alert.alert(
        mode === "create" ? "Couldn't add card" : "Couldn't update",
        e instanceof Error ? e.message : "Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = () => {
    if (!gradeId) return;
    Alert.alert(
      "Remove from vault?",
      "This will delete the holding. The card stays in the catalog.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMut.mutateAsync(gradeId);
              router.back();
            } catch (e) {
              Alert.alert(
                "Couldn't delete",
                e instanceof Error ? e.message : "Try again in a moment.",
              );
            }
          },
        },
      ],
    );
  };

  // Live headline figure for the hero — the user's typed estimate when
  // present, otherwise the market suggestion. Drives the big number.
  const displayValue: number | null =
    estimatedValue !== "" ? Number(estimatedValue) : suggestedEstimate;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg.base }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      {/* Top bar — stays pinned above the scroll content. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 10,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <ChevronLeft size={18} color={p.ink.default} />
        </Pressable>
        <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
          {mode === "create" ? "Add to vault" : "Edit holding"}
        </Text>
        {mode === "edit" && gradeId ? (
          <Pressable
            onPress={onDelete}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Delete holding"
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
          >
            <Trash2 size={16} color={p.accent.rose} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 40,
          gap: 22,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — centered card portrait, title, set/year, TCG pill. */}
        <View style={{ alignItems: "center", gap: 14, paddingTop: 4 }}>
          <View
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.28,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
              elevation: 8,
              borderRadius: 14,
            }}
          >
            <CardImage
              uri={card.imageUrl}
              width={132}
              height={184}
              rounded={14}
              contentFit="contain"
              alt={card.name ?? "Card"}
            />
          </View>
          <View style={{ alignItems: "center", gap: 5 }}>
            <Text
              style={{
                color: p.ink.default,
                fontSize: 20,
                fontWeight: "700",
                textAlign: "center",
                letterSpacing: -0.3,
              }}
              numberOfLines={2}
            >
              {card.name ?? "Unknown card"}
            </Text>
            <Text
              style={{ color: p.ink.muted, fontSize: 13, fontWeight: "500" }}
              numberOfLines={1}
            >
              {[card.setName, card.year ? String(card.year) : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </Text>
          </View>
        </View>

        {/* Estimated-value headline — Robinhood-style big number framed
            by hairline rules. Reflects the live estimate as the user
            tweaks grade / house / the value field. */}
        <View
          style={{
            alignItems: "center",
            gap: 4,
            paddingVertical: 18,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: p.line.default,
          }}
        >
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Estimated value
          </Text>
          <Text
            style={{
              color: p.ink.default,
              fontSize: 36,
              fontWeight: "800",
              letterSpacing: -1,
            }}
          >
            {displayValue != null && Number.isFinite(displayValue)
              ? money(displayValue, { compact: false })
              : marketQ.isLoading && mode === "create"
                ? "—"
                : money(0, { compact: false })}
          </Text>
        </View>

      {/* Grade */}
      <Field label="Grade" hint="0 – 10. Use 0 for a raw / ungraded card.">
        <TextInput
          value={grade}
          onChangeText={(t) => setGrade(clampNumeric(t, 10))}
          placeholder="e.g. 9.5"
          placeholderTextColor={p.ink.dim}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={inputStyle(p)}
        />
      </Field>

      {/* House */}
      <Field label="Grading house">
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {HOUSES.map((h) => {
            const active = house === h.id;
            return (
              <Pressable
                key={h.id}
                onPress={() => setHouse(h.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? p.accent.mint : p.line.default,
                  backgroundColor: active
                    ? withAlpha(p.accent.mint, 0.15)
                    : "transparent",
                }}
              >
                <Text
                  style={{
                    color: active ? p.accent.mint : p.ink.muted,
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.4,
                  }}
                >
                  {h.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {/* Condition — RAW only. The chip vocabulary matches per-condition
          pricing on eBay so the future "estimated value" lookup can key
          off the same slug without a translation table. */}
      {house === "loupe" ? (
        <Field
          label="Condition"
          hint="PSA-style vocab. Drives per-condition pricing once comps are live."
        >
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {CONDITIONS.map((c) => {
              const active = condition === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCondition(active ? null : c.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? p.accent.mint : p.line.default,
                    backgroundColor: active
                      ? withAlpha(p.accent.mint, 0.15)
                      : "transparent",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      color: active ? p.accent.mint : p.ink.muted,
                      fontSize: 12,
                      fontWeight: "700",
                      letterSpacing: 0.4,
                    }}
                  >
                    {c.short}
                  </Text>
                  <Text
                    style={{
                      color: active ? p.accent.mint : p.ink.dim,
                      fontSize: 11,
                      fontWeight: "500",
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}

      {/* Copies — create-mode only. Adds N identical holdings in one go,
          mirroring the web "Copies" field. Editing a single holding never
          changes the count, so it's hidden in edit mode. */}
      {mode === "create" ? (
        <Field
          label="Copies"
          hint="How many of this exact card you own. Adds one holding each."
        >
          <TextInput
            value={copies}
            onChangeText={(t) => setCopies(t.replace(/[^0-9]/g, "").slice(0, 2))}
            placeholder="1"
            placeholderTextColor={p.ink.dim}
            keyboardType="number-pad"
            inputMode="numeric"
            style={inputStyle(p)}
          />
        </Field>
      ) : null}

      {/* Purchase price */}
      <Field
        label="What you paid (USD)"
        hint="Optional — leave blank if you don't want to track P/L."
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              ...inputStyle(p),
              flex: 0,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderRightWidth: 0,
              color: p.ink.muted,
            }}
          >
            $
          </Text>
          <TextInput
            value={purchasePrice}
            onChangeText={(t) => setPurchasePrice(clampCurrency(t))}
            placeholder="0.00"
            placeholderTextColor={p.ink.dim}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={{
              ...inputStyle(p),
              flex: 1,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }}
          />
        </View>
      </Field>

      {/* Purchase date */}
      <Field
        label="Purchase date"
        hint={
          heldDays != null
            ? `Held for ${heldDays.toLocaleString()} day${heldDays === 1 ? "" : "s"}.`
            : "Format: YYYY-MM-DD"
        }
        error={!dateValid ? "Use YYYY-MM-DD." : null}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={purchaseDate}
            onChangeText={(t) => setPurchaseDate(t.replace(/[^0-9-]/g, ""))}
            placeholder="2024-08-15"
            placeholderTextColor={p.ink.dim}
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="numeric"
            style={{ ...inputStyle(p), flex: 1 }}
          />
          <Pressable
            onPress={() => setPurchaseDate(todayIso())}
            style={{
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Calendar size={14} color={p.ink.muted} />
            <Text className="text-[12px] font-semibold text-ink-muted">
              Today
            </Text>
          </Pressable>
        </View>
      </Field>

      {/* Estimated value — auto-prefilled from the live market snapshot
          on create. Picks raw / graded_avg / pop_top based on the
          current grade & house, then stops syncing the moment the user
          edits the field manually. */}
      <Field
        label="Estimated value (USD)"
        hint={
          mode === "create"
            ? marketQ.isLoading && estimatedValue === ""
              ? "Fetching current market value…"
              : autoFilledFromMarket && !estValueTouchedRef.current
                ? `Auto-filled from current market ${
                    house === "loupe"
                      ? "(raw)"
                      : Number(grade) >= 8
                        ? "(top-tier comp)"
                        : "(graded avg)"
                  }. Edit to override.`
                : "Edit to override the auto market estimate."
            : "Optional — overrides the auto market estimate."
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              ...inputStyle(p),
              flex: 0,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderRightWidth: 0,
              color: p.ink.muted,
            }}
          >
            $
          </Text>
          <TextInput
            value={estimatedValue}
            onChangeText={(t) => {
              estValueTouchedRef.current = true;
              setAutoFilledFromMarket(false);
              setEstimatedValue(clampCurrency(t));
            }}
            placeholder={
              marketQ.isLoading && mode === "create" ? "Loading…" : "0.00"
            }
            placeholderTextColor={p.ink.dim}
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={{
              ...inputStyle(p),
              flex: 1,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }}
          />
        </View>
      </Field>

      {/* Tags — user organization labels ("PC", "For sale", …). */}
      <Field label="Tags" hint="Organize + filter your vault. Tap a chip to remove.">
        <TagInput
          value={tags}
          onChange={setTags}
          suggestions={tagSuggestions.data?.availableTags ?? []}
        />
      </Field>

      {/* Notes */}
      <Field label="Notes" hint="Slab cert #, condition notes, anything.">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          placeholderTextColor={p.ink.dim}
          multiline
          numberOfLines={4}
          style={{
            ...inputStyle(p),
            minHeight: 90,
            paddingTop: 12,
            textAlignVertical: "top",
          }}
        />
      </Field>
    </ScrollView>

      {/* Sticky CTA — full-width, sits above the home indicator with a
          hairline separator, the way Robinhood pins its primary action. */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === "ios" ? 28 : 16,
          borderTopWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.base,
        }}
      >
        <PrimaryButton
          label={mode === "create" ? "Add to vault" : "Save changes"}
          onPress={onSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
        {label}
      </Text>
      {children}
      {error ? (
        <Text style={{ color: palette.accent.rose, fontSize: 11 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[11px] text-ink-dim">{hint}</Text>
      ) : null}
    </View>
  );
}

function inputStyle(
  p: ReturnType<typeof useThemedPalette>,
): {
  height: number;
  paddingHorizontal: number;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
  backgroundColor: string;
  color: string;
  fontSize: number;
  fontWeight: "500";
} {
  return {
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: p.line.default,
    borderRadius: 14,
    backgroundColor: p.bg.elevated,
    color: p.ink.default,
    fontSize: 15,
    fontWeight: "500",
  };
}
