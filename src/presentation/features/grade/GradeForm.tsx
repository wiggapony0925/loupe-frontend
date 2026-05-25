/**
 * GradeForm — reusable form for adding a card to the vault manually
 * and for editing an existing holding.
 *
 * The same form is used by two screens:
 *   • `/grade/new?cardId=…|upstreamId=…` — POST /v1/grades
 *   • `/grade/[id]`                       — PATCH /v1/grades/{id}
 *
 * Field set mirrors the backend write paths in `app/schemas/grade.py`:
 *   grade · house · purchase price · purchase date · estimated value · notes
 *
 * Card identity is shown read-only at the top (thumbnail · title · set /
 * year); the form does not let the user re-pick the card once it's bound.
 * For a true "I don't know which card this is yet" flow, send them
 * through the search screen first.
 */
import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Calendar, ChevronLeft, Trash2 } from "lucide-react-native";
import { CardImage } from "@/presentation/components/CardImage";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import {
  useCreateGrade,
  useDeleteGrade,
  useUpdateGrade,
} from "@/application/queries";
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
  const createMut = useCreateGrade();
  const updateMut = useUpdateGrade();
  const deleteMut = useDeleteGrade();

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
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

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
        await createMut.mutateAsync({
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
        });
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
        });
      }
      router.back();
    } catch (e) {
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

  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: 96, gap: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
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
            className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
          >
            <Trash2 size={16} color={p.accent.rose} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Card identity (read-only) */}
      <View
        style={{
          flexDirection: "row",
          gap: 14,
          padding: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: p.line.default,
          backgroundColor: p.bg.elevated,
        }}
      >
        <CardImage
          uri={card.imageUrl}
          width={64}
          height={90}
          rounded={10}
          contentFit="contain"
          alt={card.name ?? "Card"}
        />
        <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            Card
          </Text>
          <Text
            className="text-base font-semibold text-ink"
            numberOfLines={2}
          >
            {card.name ?? "Unknown card"}
          </Text>
          <Text className="text-[12px] text-ink-muted" numberOfLines={1}>
            {[card.setName, card.year ? String(card.year) : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </Text>
        </View>
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

      {/* Estimated value */}
      <Field
        label="Estimated value (USD)"
        hint="Optional — overrides the auto market estimate."
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
            onChangeText={(t) => setEstimatedValue(clampCurrency(t))}
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

      <View style={{ paddingTop: 8 }}>
        <PrimaryButton
          label={mode === "create" ? "Add to vault" : "Save changes"}
          onPress={onSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
      </View>
    </ScrollView>
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
