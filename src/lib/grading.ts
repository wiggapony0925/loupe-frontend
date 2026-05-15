/**
 * Trading-card grading reference.
 *
 * Loupe's forensic engine produces a `composite` score on a 0..1000 scale and
 * four sub-axis scores on the same scale:
 *
 *   - centering  — symmetry of the printed image inside the card border
 *   - corners    — fraying / rounding / whitening on each corner
 *   - edges      — chipping / rough cuts on each edge
 *   - surface    — print lines, scratches, gloss loss, foil scuffs
 *
 * This module converts those raw scores into the grades used by the four
 * dominant authentication houses, so the report screen can show "what would
 * PSA / CGC / TAG / BGS call this card."
 *
 * House-by-house cheat sheet:
 *
 * ┌────────┬────────────────┬──────────────┬─────────────────────────────────┐
 * │ House  │ Scale          │ Subgrades?   │ Notes                            │
 * ├────────┼────────────────┼──────────────┼─────────────────────────────────┤
 * │ PSA    │ 1, 1.5, 2..10  │ rare (Gold)  │ "10 = Gem Mint", half-pts        │
 * │ CGC    │ 1..10 (½ pts)  │ yes — C/E/S/c│ "Pristine 10" reserved for 10/10 │
 * │ BGS    │ 1..10 (½ pts)  │ always       │ Final grade ≈ lowest subgrade    │
 * │ TAG    │ 1..1000 + 1-10 │ always       │ AI-driven; publishes defect map  │
 * └────────┴────────────────┴──────────────┴─────────────────────────────────┘
 */

export type GradingHouse = "PSA" | "CGC" | "BGS" | "TAG";

/** A single tier in a 1..10 grading scale (used by PSA / CGC / BGS). */
export interface GradeTier {
  /** Numeric grade, e.g. 9, 9.5, 10. */
  value: number;
  /** Short label, e.g. "GEM-MT", "MINT", "NM-MT". */
  short: string;
  /** Long label for tooltips / detail rows. */
  long: string;
}

/**
 * PSA's published 13-tier scale. Half-grades (1.5, 8.5) are real but
 * less common; PSA does not assign 9.5 — it's a CGC/BGS-only step.
 */
export const PSA_TIERS: readonly GradeTier[] = [
  { value: 10, short: "GEM-MT", long: "Gem Mint 10" },
  { value: 9, short: "MINT", long: "Mint 9" },
  { value: 8.5, short: "NM-MT+", long: "Near Mint–Mint+ 8.5" },
  { value: 8, short: "NM-MT", long: "Near Mint–Mint 8" },
  { value: 7, short: "NM", long: "Near Mint 7" },
  { value: 6, short: "EX-MT", long: "Excellent–Mint 6" },
  { value: 5, short: "EX", long: "Excellent 5" },
  { value: 4, short: "VG-EX", long: "Very Good–Excellent 4" },
  { value: 3, short: "VG", long: "Very Good 3" },
  { value: 2, short: "GOOD", long: "Good 2" },
  { value: 1.5, short: "FR", long: "Fair 1.5" },
  { value: 1, short: "PR", long: "Poor 1" },
];

/**
 * CGC's scale matches PSA's tiers but adds the half-step 9.5 ("Mint+") and
 * a special **Pristine 10** reserved for cards that earn straight 10s on
 * all four subgrades.
 */
export const CGC_TIERS: readonly GradeTier[] = [
  { value: 10, short: "PRISTINE", long: "Pristine 10 (perfect subgrades)" },
  { value: 10, short: "GEM-MT", long: "Gem Mint 10" },
  { value: 9.5, short: "MINT+", long: "Mint+ 9.5" },
  { value: 9, short: "MINT", long: "Mint 9" },
  { value: 8.5, short: "NM-MT+", long: "Near Mint–Mint+ 8.5" },
  { value: 8, short: "NM-MT", long: "Near Mint–Mint 8" },
  { value: 7.5, short: "NM+", long: "Near Mint+ 7.5" },
  { value: 7, short: "NM", long: "Near Mint 7" },
  { value: 6, short: "EX-MT", long: "Excellent–Mint 6" },
  { value: 5, short: "EX", long: "Excellent 5" },
  { value: 4, short: "VG-EX", long: "Very Good–Excellent 4" },
  { value: 3, short: "VG", long: "Very Good 3" },
  { value: 2, short: "GOOD", long: "Good 2" },
  { value: 1, short: "PR", long: "Poor 1" },
];

/**
 * BGS adds "Pristine 10" and "Black Label" (10 across every subgrade).
 * The final grade is typically the *lowest* subgrade, then bumped a half
 * step if the other three are all higher — captured by `bgsFromSubgrades`.
 */
export const BGS_TIERS: readonly GradeTier[] = [
  { value: 10, short: "BLACK", long: "Black Label 10 (10/10/10/10)" },
  { value: 10, short: "PRISTINE", long: "Pristine 10" },
  { value: 9.5, short: "GEM-MT", long: "Gem Mint 9.5" },
  { value: 9, short: "MINT", long: "Mint 9" },
  { value: 8.5, short: "NM-MT+", long: "Near Mint–Mint+ 8.5" },
  { value: 8, short: "NM-MT", long: "Near Mint–Mint 8" },
  { value: 7, short: "NM", long: "Near Mint 7" },
  { value: 6, short: "EX-MT", long: "Excellent–Mint 6" },
  { value: 5, short: "EX", long: "Excellent 5" },
  { value: 4, short: "VG-EX", long: "Very Good–Excellent 4" },
];

/** Semantic colour token name for a grade — resolved against the palette. */
export type GradeTone = "mint" | "blue" | "amber" | "rose" | "muted";

/**
 * Map a numeric grade (1..10) to a tone token. Used everywhere we render
 * a grade chip so colour stays consistent across screens.
 */
export function gradeTone(grade: number): GradeTone {
  if (grade >= 9.5) return "mint";
  if (grade >= 8.5) return "blue";
  if (grade >= 7) return "amber";
  if (grade >= 4) return "rose";
  return "muted";
}

/** Composite score → PSA tier. PSA caps at 10 and never assigns 9.5. */
export function psaFromComposite(composite: number): GradeTier {
  const clamped = clamp(composite, 0, 1000);
  // PSA cutoffs are conservative: GEM-MT requires near-perfect on every axis.
  if (clamped >= 970) return tier(PSA_TIERS, 10);
  if (clamped >= 920) return tier(PSA_TIERS, 9);
  if (clamped >= 880) return tier(PSA_TIERS, 8.5);
  if (clamped >= 820) return tier(PSA_TIERS, 8);
  if (clamped >= 760) return tier(PSA_TIERS, 7);
  if (clamped >= 690) return tier(PSA_TIERS, 6);
  if (clamped >= 600) return tier(PSA_TIERS, 5);
  if (clamped >= 500) return tier(PSA_TIERS, 4);
  if (clamped >= 380) return tier(PSA_TIERS, 3);
  if (clamped >= 250) return tier(PSA_TIERS, 2);
  if (clamped >= 150) return tier(PSA_TIERS, 1.5);
  return tier(PSA_TIERS, 1);
}

/** Composite score → CGC tier. CGC awards 9.5 and the rare Pristine 10. */
export function cgcFromComposite(
  composite: number,
  subgrades?: { centering: number; corners: number; edges: number; surface: number },
): GradeTier {
  const clamped = clamp(composite, 0, 1000);
  // Pristine 10 only when *every* subgrade is essentially perfect.
  if (
    subgrades &&
    Math.min(subgrades.centering, subgrades.corners, subgrades.edges, subgrades.surface) >= 985
  ) {
    return CGC_TIERS[0]!;
  }
  if (clamped >= 970) return tier(CGC_TIERS, 10);
  if (clamped >= 940) return tier(CGC_TIERS, 9.5);
  if (clamped >= 900) return tier(CGC_TIERS, 9);
  if (clamped >= 860) return tier(CGC_TIERS, 8.5);
  if (clamped >= 800) return tier(CGC_TIERS, 8);
  if (clamped >= 740) return tier(CGC_TIERS, 7.5);
  if (clamped >= 680) return tier(CGC_TIERS, 7);
  if (clamped >= 600) return tier(CGC_TIERS, 6);
  if (clamped >= 500) return tier(CGC_TIERS, 5);
  if (clamped >= 400) return tier(CGC_TIERS, 4);
  if (clamped >= 300) return tier(CGC_TIERS, 3);
  if (clamped >= 200) return tier(CGC_TIERS, 2);
  return tier(CGC_TIERS, 1);
}

/**
 * BGS uses subgrades to derive the final grade. The published rule is:
 *   - Final = lowest subgrade
 *   - If the other three are all ≥ final + 1.0, bump final by 0.5
 *   - If all four are 10, "Black Label"
 */
export function bgsFromSubgrades(s: {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
}): GradeTier {
  const subs = [
    scoreTo10(s.centering),
    scoreTo10(s.corners),
    scoreTo10(s.edges),
    scoreTo10(s.surface),
  ].sort((a, b) => a - b);
  const lowest = subs[0]!;
  if (lowest >= 10) return BGS_TIERS[0]!; // Black Label
  const others = subs.slice(1);
  const bumped = others.every((v) => v >= lowest + 1) ? lowest + 0.5 : lowest;
  const rounded = Math.min(10, Math.round(bumped * 2) / 2);
  return tier(BGS_TIERS, rounded);
}

/**
 * TAG publishes a 1..1000 score and a corresponding 1..10 letter band.
 * We expose both — the 1000 number is what TAG prints largest on the slab.
 */
export interface TagGrade {
  /** 1..1000 — TAG's primary score. */
  score: number;
  /** 1..10 — derived for cross-house comparison. */
  bucket: number;
  /** Letter rating: A++, A+, A, A-, B+, … F. */
  letter: string;
  /** Short tier label, e.g. "Gem Mint", "Pristine". */
  short: string;
}

export function tagFromComposite(composite: number): TagGrade {
  const score = Math.round(clamp(composite, 0, 1000));
  const bucket =
    score >= 970 ? 10
      : score >= 920 ? 9.5
      : score >= 880 ? 9
      : score >= 820 ? 8.5
      : score >= 760 ? 8
      : score >= 700 ? 7.5
      : score >= 640 ? 7
      : score >= 560 ? 6
      : score >= 480 ? 5
      : score >= 380 ? 4
      : score >= 280 ? 3
      : score >= 180 ? 2
      : 1;
  const letter =
    bucket >= 10 ? "A++"
      : bucket >= 9.5 ? "A+"
      : bucket >= 9 ? "A"
      : bucket >= 8.5 ? "A-"
      : bucket >= 8 ? "B+"
      : bucket >= 7 ? "B"
      : bucket >= 6 ? "B-"
      : bucket >= 5 ? "C+"
      : bucket >= 4 ? "C"
      : bucket >= 3 ? "D"
      : "F";
  const short =
    bucket >= 10 ? "PRISTINE"
      : bucket >= 9.5 ? "GEM-MT+"
      : bucket >= 9 ? "GEM-MT"
      : bucket >= 8 ? "MINT"
      : bucket >= 7 ? "NM"
      : bucket >= 6 ? "EX-MT"
      : bucket >= 5 ? "EX"
      : "PLAYED";
  return { score, bucket, letter, short };
}

/** Convert a 0..1000 sub-axis score to its 1..10 equivalent. */
export function scoreTo10(score: number): number {
  const v = clamp(score, 0, 1000) / 100;
  return Math.round(v * 2) / 2; // half-point precision
}

export interface HouseGradeResult {
  house: GradingHouse;
  /** Numeric headline grade (1..10 for PSA/CGC/BGS, 1..1000 for TAG). */
  headline: string;
  /** Short tier name e.g. "GEM-MT". */
  short: string;
  /** Long tier name e.g. "Gem Mint 10". */
  long: string;
  /** Optional secondary line (TAG letter, BGS subgrade summary, etc.). */
  detail?: string;
  /** Tone token for chips / borders. */
  tone: GradeTone;
}

/** Compute every house's grade for a single forensic score. */
export function gradeAcrossHouses(score: {
  composite: number;
  centering: number;
  corners: number;
  edges: number;
  surface: number;
}): HouseGradeResult[] {
  const psa = psaFromComposite(score.composite);
  const cgc = cgcFromComposite(score.composite, score);
  const bgs = bgsFromSubgrades(score);
  const tag = tagFromComposite(score.composite);

  return [
    {
      house: "PSA",
      headline: formatGrade(psa.value),
      short: psa.short,
      long: psa.long,
      tone: gradeTone(psa.value),
    },
    {
      house: "CGC",
      headline: formatGrade(cgc.value),
      short: cgc.short,
      long: cgc.long,
      detail: subgradeSummary(score),
      tone: gradeTone(cgc.value),
    },
    {
      house: "BGS",
      headline: formatGrade(bgs.value),
      short: bgs.short,
      long: bgs.long,
      detail: subgradeSummary(score),
      tone: gradeTone(bgs.value),
    },
    {
      house: "TAG",
      headline: `${tag.score}`,
      short: tag.short,
      long: `${tag.letter} · ${tag.short}`,
      detail: `Bucket ${formatGrade(tag.bucket)} · ${tag.letter}`,
      tone: gradeTone(tag.bucket),
    },
  ];
}

function subgradeSummary(s: {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
}): string {
  return [
    `C ${formatGrade(scoreTo10(s.centering))}`,
    `Cn ${formatGrade(scoreTo10(s.corners))}`,
    `E ${formatGrade(scoreTo10(s.edges))}`,
    `S ${formatGrade(scoreTo10(s.surface))}`,
  ].join("  ·  ");
}

/** Render 9 → "9", 9.5 → "9.5", 10 → "10". */
export function formatGrade(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function tier(tiers: readonly GradeTier[], value: number): GradeTier {
  return tiers.find((t) => t.value === value) ?? tiers[tiers.length - 1]!;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
