/**
 * DataSourcesFooter — shows which upstream providers are wired in
 * (eBay, PSA, TCGplayer, …) for the current build. Pulls live status
 * from `GET /v1/providers/status` so backend env changes light up
 * without a frontend ship.
 */
import React from "react";
import { View, Text } from "react-native";
import { useThemedPalette } from "@/presentation/theme/tokens";
import { useProvidersStatus } from "@/application/queries/ops/useProvidersStatus";

const PROVIDER_LABEL: Record<string, string> = {
  ebay: "eBay",
  psa: "PSA",
  tcgplayer: "TCGplayer",
  pricecharting: "PriceCharting",
  point130: "130point",
  gocollect: "GoCollect",
};

export function DataSourcesFooter() {
  const p = useThemedPalette();
  const { data } = useProvidersStatus();
  const providers = data?.providers ?? [];

  if (providers.length === 0) return null;

  return (
    <View
      style={{
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: p.bg.elevated,
        borderWidth: 1,
        borderColor: p.line.default,
        gap: 8,
      }}
    >
      <Text
        style={{
          color: p.ink.muted,
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        Data Sources
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {providers.map((prov) => {
          const live = prov.configured;
          return (
            <View
              key={prov.id}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: p.bg.base,
                borderWidth: 1,
                borderColor: live ? p.accent.mint : p.line.default,
              }}
            >
              <Text
                style={{
                  color: live ? p.accent.mint : p.ink.muted,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {PROVIDER_LABEL[prov.id] ?? prov.id}
                {live ? " · live" : " · est"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
