import type { IdentifyCandidate } from "@/infrastructure/repositories/identifyRepository";

/**
 * One captured frame in the rolling scan-session tray. Each capture drops
 * in as a `"scanning"` photo, then resolves in place to `"matched"`
 * (with a catalog candidate + price/ownership enrichment) or `"missed"`.
 * The same model backs both the expo-camera flow and the native flow so
 * the tray, "Add all", and per-tile UI are identical everywhere.
 */
export interface ScanSessionItem {
  id: string;
  photoUri: string;
  candidate: IdentifyCandidate | null;
  identificationId: string | null;
  confidence: number | null;
  status: "scanning" | "matched" | "missed";
}
