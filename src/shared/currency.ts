/**
 * Loupe's currency catalog — fiat + crypto.
 *
 * Rates are quoted as "1 USD = X <code>". These app-side conversion
 * constants keep display formatting deterministic; market prices still
 * come from the backend.
 */

export type CurrencyKind = "fiat" | "crypto";

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
  /** Format flag emoji (fiat) or stylized glyph (crypto). */
  flag: string;
  kind: CurrencyKind;
  /** 1 USD → this many units of the currency. */
  ratePerUsd: number;
  /** Decimals to render in compact mode. */
  decimals: number;
}

export const CURRENCIES: CurrencyMeta[] = [
  // ── Major fiat
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸", kind: "fiat", ratePerUsd: 1, decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺", kind: "fiat", ratePerUsd: 0.92, decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧", kind: "fiat", ratePerUsd: 0.79, decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵", kind: "fiat", ratePerUsd: 156.4, decimals: 0 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦", kind: "fiat", ratePerUsd: 1.37, decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺", kind: "fiat", ratePerUsd: 1.51, decimals: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "₣", flag: "🇨🇭", kind: "fiat", ratePerUsd: 0.91, decimals: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳", kind: "fiat", ratePerUsd: 7.24, decimals: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰", kind: "fiat", ratePerUsd: 7.81, decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬", kind: "fiat", ratePerUsd: 1.35, decimals: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷", kind: "fiat", ratePerUsd: 1378, decimals: 0 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳", kind: "fiat", ratePerUsd: 83.4, decimals: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "$", flag: "🇲🇽", kind: "fiat", ratePerUsd: 17.1, decimals: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷", kind: "fiat", ratePerUsd: 5.12, decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪", kind: "fiat", ratePerUsd: 3.67, decimals: 2 },
  // ── Crypto
  { code: "BTC", name: "Bitcoin", symbol: "₿", flag: "₿", kind: "crypto", ratePerUsd: 1 / 67_400, decimals: 6 },
  { code: "ETH", name: "Ethereum", symbol: "Ξ", flag: "Ξ", kind: "crypto", ratePerUsd: 1 / 3_120, decimals: 4 },
  { code: "SOL", name: "Solana", symbol: "◎", flag: "◎", kind: "crypto", ratePerUsd: 1 / 152, decimals: 3 },
  { code: "USDC", name: "USD Coin", symbol: "$", flag: "Ⓤ", kind: "crypto", ratePerUsd: 1, decimals: 2 },
  { code: "USDT", name: "Tether", symbol: "₮", flag: "₮", kind: "crypto", ratePerUsd: 1, decimals: 2 },
  { code: "MATIC", name: "Polygon", symbol: "◆", flag: "◆", kind: "crypto", ratePerUsd: 1 / 0.71, decimals: 2 },
];

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const BY_CODE: Record<string, CurrencyMeta> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c]),
);

export function getCurrency(code: string): CurrencyMeta {
  return BY_CODE[code] ?? BY_CODE.USD!;
}

/** Convert a USD amount → the target currency's native units. */
export function convertUsd(usd: number, code: string): number {
  return usd * getCurrency(code).ratePerUsd;
}

/**
 * Compact money formatter with currency awareness.
 *
 *   formatMoney(28_540, "USD") → "$28.5k"
 *   formatMoney(28_540, "JPY") → "¥4.46M"
 *   formatMoney(28_540, "BTC") → "₿0.4234"
 */
export function formatMoney(usd: number, code: string, opts?: { compact?: boolean }): string {
  const meta = getCurrency(code);
  const value = convertUsd(usd, code);
  const compact = opts?.compact ?? true;
  if (compact && meta.kind === "fiat") {
    if (value >= 1_000_000) return `${meta.symbol}${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${meta.symbol}${(value / 1_000).toFixed(1)}k`;
    return `${meta.symbol}${value.toFixed(meta.decimals)}`;
  }
  return `${meta.symbol}${value.toFixed(meta.decimals)}`;
}
