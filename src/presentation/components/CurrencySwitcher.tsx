import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useDisplayCurrency } from "@/application/hooks/useDisplayCurrency";
import { useMoney } from "@/presentation/components/Price";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";
import { CurrencyPickerSheet } from "./CurrencyPickerSheet";

export function CurrencySwitcher() {
  const p = useThemedPalette();
  const { currency, setCurrency } = useDisplayCurrency();
  const { meta: ccyMeta } = useMoney();
  const [pickerOpen, setPickerOpen] = useState(false);

  const ccyTint = ccyMeta.kind === "crypto" ? p.accent.amber : p.accent.mint;

  return (
    <>
      <Pressable
        onPress={() => setPickerOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Currency ${ccyMeta.code}. Tap to change.`}
        className="flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5"
        style={({ pressed }) => ({
          opacity: pressed ? 0.75 : 1,
          borderColor: withAlpha(ccyTint, 0.45),
          backgroundColor: withAlpha(ccyTint, 0.12),
        })}
      >
        <Text style={{ fontSize: 12 }}>{ccyMeta.flag}</Text>
        <Text
          style={{
            color: ccyTint,
            fontSize: 11,
            fontWeight: "800",
            letterSpacing: 0.6,
          }}
        >
          {ccyMeta.code}
        </Text>
        <ChevronDown size={11} color={ccyTint} strokeWidth={2.6} />
      </Pressable>
      <CurrencyPickerSheet
        visible={pickerOpen}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
