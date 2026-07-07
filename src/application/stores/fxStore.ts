/**
 * fxStore — live FX rates from the backend (`GET /v1/market/fx/rates`).
 *
 * ONE source of truth for currency conversion: the server fetches real
 * fiat + crypto rates (cached fleet-wide), and every client renders with
 * the same table — a card is worth the same ¥ on web and mobile. The
 * static `ratePerUsd` snapshot in `shared/currency.ts` remains only as
 * the offline / first-paint fallback.
 */
import { create } from "zustand";

export interface FxRatesDoc {
  base: string;
  as_of: string | null;
  source: string;
  rates: Record<string, number>;
}

interface FxState {
  rates: Record<string, number> | null;
  asOf: string | null;
  source: string | null;
  setRates: (doc: FxRatesDoc) => void;
}

export const useFxStore = create<FxState>()((set) => ({
  rates: null,
  asOf: null,
  source: null,
  setRates: (doc) =>
    set({ rates: doc.rates, asOf: doc.as_of, source: doc.source }),
}));
