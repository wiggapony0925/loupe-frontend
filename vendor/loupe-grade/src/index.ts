/**
 * @loupe/grade — the Loupe Grade rubric engine (pure TS, no DOM/RN/React).
 *
 * A transparent, explainable pre-screen estimate — NOT an official grade. It
 * mirrors public PSA centering tolerances and a simple sub-grade blend so a
 * collector can sanity-check a raw card before paying to grade it.
 *
 * Shared by loupe-web (the `/grade` "Loupe Playground") and loupe-frontend
 * (the native playground) so both compute the exact same estimate. The
 * web-only canvas auto-detection (`detectCard`) stays in loupe-web — it needs
 * `HTMLImageElement`/`canvas` and doesn't belong in a framework-agnostic core.
 */

/** A frame in normalized [0,1] coords relative to the image box. */
export interface Frame {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Centering {
  /** Horizontal split as the larger side %, e.g. 53 means 53/47. */
  hLarger: number;
  vLarger: number;
  hLabel: string; // "53 / 47"
  vLabel: string;
  /** Centering sub-grade 1–10 (the worse axis governs). */
  grade: number;
}

/**
 * PSA front-centering tolerance → the best grade that split can earn.
 * Keyed by the *larger* side percentage. (Reverse/back is looser; we estimate
 * on the stricter front number, which is what a single listing photo shows.)
 */
const CENTERING_LADDER: Array<[maxLargerPct: number, grade: number]> = [
  [55, 10],
  [60, 9],
  [65, 8],
  [70, 7],
  [75, 6],
  [80, 5],
  [85, 4],
  [90, 3],
];

export function centeringGrade(largerPct: number): number {
  for (const [max, grade] of CENTERING_LADDER) if (largerPct <= max) return grade;
  return 2;
}

/**
 * Centering from an outer (card edge) + inner (print border) frame. The four
 * border widths give the L/R and T/B splits, exactly how PSA measures it.
 */
export function measureCentering(outer: Frame, inner: Frame): Centering | null {
  const leftB = inner.left - outer.left;
  const rightB = outer.right - inner.right;
  const topB = inner.top - outer.top;
  const botB = outer.bottom - inner.bottom;
  // Inner must sit inside outer with positive borders, or the marks are invalid.
  if (leftB < 0 || rightB < 0 || topB < 0 || botB < 0) return null;
  const hSum = leftB + rightB;
  const vSum = topB + botB;
  if (hSum <= 0 || vSum <= 0) return null;

  const hLeftPct = (leftB / hSum) * 100;
  const vTopPct = (topB / vSum) * 100;
  const hLarger = Math.max(hLeftPct, 100 - hLeftPct);
  const vLarger = Math.max(vTopPct, 100 - vTopPct);

  const r = (n: number) => Math.round(n);
  return {
    hLarger,
    vLarger,
    hLabel: `${r(hLeftPct)} / ${r(100 - hLeftPct)}`,
    vLabel: `${r(vTopPct)} / ${r(100 - vTopPct)}`,
    grade: Math.min(centeringGrade(hLarger), centeringGrade(vLarger)),
  };
}

export interface SubGrades {
  centering: number;
  corners: number;
  edges: number;
  surface: number;
}

export interface LoupeGradeResult {
  /** Point estimate 1–10 (half-point resolution). */
  estimate: number;
  /** Conservative band the card is likely to fall in, e.g. "PSA 8–9". */
  band: string;
  /** Plain-English read of the estimate. */
  verdict: string;
  subs: SubGrades;
}

/**
 * Blend the four sub-grades into an overall estimate. Weighted toward
 * centering + corners (what graders punish hardest), then capped so a single
 * weak sub-grade can't be hidden by strong ones — the way real grading works.
 */
export function loupeGrade(subs: SubGrades): LoupeGradeResult {
  const weighted =
    subs.centering * 0.3 +
    subs.corners * 0.3 +
    subs.edges * 0.2 +
    subs.surface * 0.2;
  const lowest = Math.min(subs.centering, subs.corners, subs.edges, subs.surface);
  // A weak sub-grade drags the ceiling down (no "averaging away" a flaw).
  const capped = Math.min(weighted, lowest + 1.5);
  const estimate = Math.max(1, Math.min(10, Math.round(capped * 2) / 2));

  const lo = Math.max(1, Math.floor(estimate));
  const hi = Math.min(10, Math.ceil(estimate));
  const band = lo === hi ? `PSA ${lo}` : `PSA ${lo}–${hi}`;

  let verdict: string;
  if (estimate >= 9.5) verdict = "Gem-mint candidate — strong grade upside.";
  else if (estimate >= 9) verdict = "Mint — likely worth grading.";
  else if (estimate >= 8) verdict = "Near-mint — grade only if the premium is there.";
  else if (estimate >= 6) verdict = "Played to excellent — usually better kept raw.";
  else verdict = "Condition issues — raw is the play.";

  return { estimate, band, verdict, subs };
}

/** The PSA tier label closest to an estimate, for matching the value ladder. */
export function nearestPsaLabel(estimate: number): string {
  return `PSA ${Math.round(estimate)}`;
}
