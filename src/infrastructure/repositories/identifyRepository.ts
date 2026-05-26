/**
 * Client for the live card-identification endpoints.
 *
 * Pairs with the backend OCR stack at `app/routers/catalog/identify.py`:
 *   • POST /v1/cards/identify              — multipart image → ranked candidates
 *   • POST /v1/cards/identify/{id}/feedback — thumbs up/down + chosen catalog id
 *
 * The live-scan UI calls `identifyCard()` on a debounced loop while the
 * viewfinder is held over a card; once the user confirms a match, it
 * fires `submitIdentifyFeedback(correct=true)` so the backend can build
 * a per-title popularity prior (no model training — just a re-rank
 * boost). A skip / "wrong match" path posts `correct=false`.
 */
import { apiFetch } from "@/infrastructure/http/client";

/** Supported TCG hints the backend accepts as a form field. */
export type IdentifyTcgHint = "pokemon" | "magic" | "yugioh" | null;

export interface IdentifyCandidate {
  card_id: string | null;
  upstream_id: string | null;
  name: string;
  set_name: string | null;
  set_code: string | null;
  number: string | null;
  image_url: string | null;
  tcg: string | null;
  confidence: number;
  source: "text" | "phash" | "feedback" | string;
  breakdown: Record<string, number>;
}

export interface IdentifyParsed {
  title: string | null;
  set_code: string | null;
  card_number: string | null;
  year: number | null;
  hp: number | null;
}

export interface IdentifyResponse {
  identification_id: string;
  candidates: IdentifyCandidate[];
  accuracy_score: number;
  primary_source: string;
  tcg_inferred: string;
  parsed: IdentifyParsed;
  ocr_provider: string;
  ocr_confidence: number;
  ocr_full_text: string;
  latency_ms: number;
  cost_usd: number;
  /**
   * Server signalled the paid OCR budget is exhausted. Re-run OCR
   * on-device (Apple Vision / ML Kit via `identifyCardFromText`) and
   * resubmit the extracted text to `/v1/cards/identify/text`.
   */
  fallback_required?: boolean;
  fallback_reason?: string | null;
}

/**
 * Send a single viewfinder frame to the identify endpoint.
 *
 * `uri` is a local `file://` (or `data:`) URI returned by
 * `expo-camera`'s `takePictureAsync`. We append it as a multipart blob
 * using the React Native FormData convention (object with uri/name/type).
 */
export async function identifyCard(
  uri: string,
  tcgHint: IdentifyTcgHint = null,
): Promise<IdentifyResponse> {
  const form = new FormData();
  form.append("image", {
    uri,
    name: "frame.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  if (tcgHint) form.append("tcg", tcgHint);

  return apiFetch<IdentifyResponse>("/v1/cards/identify", {
    method: "POST",
    body: form,
  });
}

export interface IdentifyFeedbackPayload {
  correct: boolean;
  chosen_card_id?: string | null;
}

/**
 * Persist user confirmation for a prior `identifyCard` call. Requires
 * an authenticated session (backend uses `require_user`); when the user
 * is signed out we no-op so the scan flow still works pre-login.
 */
export async function submitIdentifyFeedback(
  identificationId: string,
  payload: IdentifyFeedbackPayload,
): Promise<void> {
  await apiFetch(`/v1/cards/identify/${encodeURIComponent(identificationId)}/feedback`, {
    method: "POST",
    json: payload,
  });
}

/**
 * Budget fallback: when `identifyCard()` returns `fallback_required=true`,
 * the client runs OCR on-device (Apple Vision / ML Kit) and POSTs the
 * extracted text here. No paid Vision call is made server-side, so
 * `cost_usd` will always be 0.
 */
export async function identifyCardFromText(
  text: string,
  tcgHint: IdentifyTcgHint = null,
  options: { clientProvider?: string; ocrConfidence?: number } = {},
): Promise<IdentifyResponse> {
  return apiFetch<IdentifyResponse>("/v1/cards/identify/text", {
    method: "POST",
    json: {
      text,
      tcg: tcgHint ?? undefined,
      client_provider: options.clientProvider ?? "client_fallback",
      ocr_confidence: options.ocrConfidence ?? 0,
    },
  });
}
