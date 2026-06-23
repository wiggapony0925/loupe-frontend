/**
 * Grade-aware overlays for the "compare grades" chart feature — the mobile
 * port of the web `compareTiers.ts` (same scales + equivalence math, mobile
 * hex colors). Lets the card-detail chart overlay PSA/BGS/CGC/SGC/TAG/raw
 * price lines so you can compare houses at a glance.
 */
export interface ComparePreset {
  /** Stable per-house key, so a toggled house stays on as the grade changes. */
  key: string;
  house: string;
  grade?: string;
  label: string;
  /** Line + swatch color (distinct per house). */
  color: string;
}

/** Houses we can overlay, in display order. */
const COMPARE_HOUSES = ["psa", "bgs", "cgc", "sgc", "tag"] as const;

const HOUSE_LABEL: Record<string, string> = {
  raw: "Raw",
  psa: "PSA",
  bgs: "BGS",
  cgc: "CGC",
  sgc: "SGC",
  tag: "TAG",
};

const HOUSE_COLOR: Record<string, string> = {
  raw: "#94A3B8",
  psa: "#0A84FF",
  bgs: "#9D6BFF",
  cgc: "#FFB020",
  sgc: "#FF6FB5",
  tag: "#2DD4BF",
};

export function houseColorOf(house: string): string {
  return HOUSE_COLOR[house] ?? "#94A3B8";
}

/**
 * Comparable numeric scales per house — what each house actually issues, used
 * to snap a target grade to that house's nearest real grade. BGS deliberately
 * tops out at 9.5 (its gem-mint chase), matching how the hobby compares houses.
 */
const HOUSE_SCALE: Record<string, number[]> = {
  psa: [10, 9, 8.5, 8, 7, 6, 5.5, 5, 4, 3, 2, 1.5, 1],
  bgs: [9.5, 9, 8.5, 8, 7, 6, 5],
  cgc: [10, 9.5, 9, 8.5, 8, 7, 6, 5],
  sgc: [10, 9.5, 9, 8.5, 8, 7, 6, 5],
  tag: [10, 9.5, 9, 8.5, 8, 7, 6, 5],
};

/** The grade a given house issues that's closest to `target` (ties resolve up). */
export function equivalentGrade(house: string, target: number): string | undefined {
  const scale = HOUSE_SCALE[house];
  if (!scale || scale.length === 0) return undefined;
  let best = scale[0]!;
  let bestDiff = Math.abs(best - target);
  for (const g of scale) {
    const diff = Math.abs(g - target);
    if (diff < bestDiff || (diff === bestDiff && g > best)) {
      best = g;
      bestDiff = diff;
    }
  }
  return String(best);
}

/**
 * Build the compare chips for the currently-selected tier. A graded tier → the
 * same grade in every other house + a raw baseline; a raw tier → each house's
 * gem-mint chase grade. Keys are the house id so a toggled chip stays on (and
 * just re-grades) when the primary grade changes.
 */
export function buildComparePresets(tier: {
  house: string;
  grade?: string;
}): ComparePreset[] {
  const presets: ComparePreset[] = [];

  if (tier.house === "raw") {
    for (const h of COMPARE_HOUSES) {
      const g = String(HOUSE_SCALE[h]?.[0] ?? 10);
      presets.push({
        key: h,
        house: h,
        grade: g,
        label: `${HOUSE_LABEL[h]} ${g}`,
        color: houseColorOf(h),
      });
    }
    return presets;
  }

  const target = Number(tier.grade ?? HOUSE_SCALE[tier.house]?.[0] ?? 10);
  for (const h of COMPARE_HOUSES) {
    if (h === tier.house) continue;
    const g = equivalentGrade(h, target);
    if (!g) continue;
    presets.push({
      key: h,
      house: h,
      grade: g,
      label: `${HOUSE_LABEL[h]} ${g}`,
      color: houseColorOf(h),
    });
  }
  presets.push({ key: "raw", house: "raw", label: "Raw", color: houseColorOf("raw") });
  return presets;
}
