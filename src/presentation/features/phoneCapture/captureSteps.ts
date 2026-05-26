/**
 * Capture-step definitions for phone-based grading.
 *
 * The backend grader expects 4 photometric frames (`lightIndex 0..3`).
 * For phone capture we synthesize that input by varying:
 *   - flash on/off       → mimics specular vs diffuse lighting
 *   - device tilt        → reveals different surface microgeometry
 *   - card side (F/B)    → centering + back-surface defects
 *
 * Studio (4-shot) maps directly onto the scanner's 4 light positions.
 * Quick (2-shot) only fills slots 0 + 3 — backend treats this as
 * reduced-confidence input.
 */
import type { PhoneCaptureStep } from "@/domain";

export const STUDIO_STEPS: PhoneCaptureStep[] = [
  {
    index: 0,
    side: "front",
    flash: false,
    tilt: "flat",
    label: "Ambient",
    instruction: "Hold the card flat under even lighting. Tap shutter when steady.",
  },
  {
    index: 1,
    side: "front",
    flash: true,
    tilt: "flat",
    label: "Flash",
    instruction: "Same angle. Flash will fire to surface scratches & holos.",
  },
  {
    index: 2,
    side: "front",
    flash: false,
    tilt: "top",
    label: "Tilt",
    instruction: "Tilt the top of the card 15° away from you to reveal edge wear.",
  },
  {
    index: 3,
    side: "back",
    flash: false,
    tilt: "flat",
    label: "Back",
    instruction: "Flip the card. Center it in the frame for back-surface grading.",
  },
];

export const QUICK_STEPS: PhoneCaptureStep[] = [
  {
    index: 0,
    side: "front",
    flash: false,
    tilt: "flat",
    label: "Scan",
    instruction: "Hold the card steady — auto-capture when locked.",
  },
];

export type PhoneCaptureMode = "studio" | "quick";

export function stepsForMode(mode: PhoneCaptureMode): PhoneCaptureStep[] {
  return mode === "studio" ? STUDIO_STEPS : QUICK_STEPS;
}
