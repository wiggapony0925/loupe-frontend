/**
 * Wire-level scalar atoms shared across resource modules.
 * All keys downstream are snake_case to match the backend contract.
 */

export type ID = string;
export type ISODate = string;
export type Currency = string;

export type Tcg =
  | "pokemon"
  | "magic"
  | "yugioh"
  | "onepiece"
  | "lorcana"
  | "sports";

/** Alias kept for back-compat with existing UI code. Prefer `Tcg`. */
export type TcgKey = Tcg;

export type ScanAngle = "front" | "back" | "top" | "bottom" | "left" | "right";
export type GradeHouse = "psa" | "cgc" | "bgs" | "sgc" | "tag" | "loupe";
export type RawCondition = "nm" | "lp" | "mp" | "hp" | "dmg";
export type ScannerTransport = "ble" | "wifi" | "offline";
export type ScanSource = "scanner" | "phone";

/**
 * Wire-level scan-job status. Mirrors backend states.
 * NOTE: The domain version (`@/domain/scan`) uses `"ready"` instead of
 * `"complete"` for UI friendliness — the repository translates.
 */
export type ScanStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "complete"
  | "failed";

/** Decimal money/grade serialized by Pydantic as a string. Coerce with `Number(x)` at the call site. */
export type DecimalString = string;

export interface Money {
  amount: number;
  currency: Currency;
}

export interface ImageAsset {
  url: string;
  width: number | null;
  height: number | null;
  alt?: string | null;
}

export interface ImageSet {
  small: ImageAsset | null;
  normal: ImageAsset | null;
  large: ImageAsset | null;
  art_crop?: ImageAsset | null;
}
