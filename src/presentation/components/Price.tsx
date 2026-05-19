import React, { useMemo } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useSettings } from "@/application/stores/settingsStore";
import { formatMoney, getCurrency, convertUsd, type CurrencyMeta } from "@/shared/currency";

/**
 * Hook giving any component the user's selected display currency plus
 * the canonical USD→display formatter. Subscribes to the settings store
 * so any component using it re-renders when the operator switches
 * currencies via the bottom-sheet picker.
 *
 *   const { format, code, symbol } = useMoney();
 *   <Text>{format(28_540)}</Text>   // → "$28.5k" / "¥4.46M" / "₿0.4234"
 */
export function useMoney() {
  const code = useSettings((s) => s.currency);
  return useMemo(() => {
    const meta: CurrencyMeta = getCurrency(code);
    return {
      code: meta.code,
      symbol: meta.symbol,
      flag: meta.flag,
      kind: meta.kind,
      meta,
      /** Compact: $28.5k / €26.3k / ¥4.46M / ₿0.4234. */
      format: (usd: number, opts?: { compact?: boolean }) =>
        formatMoney(usd, code, { compact: opts?.compact ?? true }),
      /** Convert USD → the display currency without rendering. */
      convert: (usd: number) => convertUsd(usd, code),
    };
  }, [code]);
}

interface PriceProps extends Omit<TextProps, "children"> {
  /** USD-denominated value — single source of truth across the app. */
  usd: number;
  /** Force long format (e.g. "$28,540") instead of compact ($28.5k). */
  compact?: boolean;
  /** Optional inline style merged with text style. */
  style?: TextStyle | TextStyle[];
}

/**
 * The single, reusable price renderer. Drop it anywhere a USD value
 * needs to be displayed and it'll automatically render in the operator's
 * selected currency (USD/EUR/JPY/BTC/ETH/etc.) and live-update when they
 * switch via the picker.
 *
 *   <Price usd={card.estimatedValueUsd} className="text-sm font-bold" />
 */
export function Price({ usd, compact, style, ...rest }: PriceProps) {
  const { format } = useMoney();
  return (
    <Text {...rest} style={style}>
      {format(usd, { compact })}
    </Text>
  );
}
