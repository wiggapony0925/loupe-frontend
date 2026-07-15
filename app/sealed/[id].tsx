/**
 * Sealed product detail sheet — hero (art · name · set · MSRP), the SAME
 * `MarketChart` used on the card detail + web (fed from the sealed value line:
 * MSRP-at-release → current), a low/mid/high price-tier strip, and a sticky
 * add-to-collection CTA.
 */
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import type { ChartSeries } from "@loupe/chart";
import { CardImage } from "@/presentation/components/CardImage";
import { MarketChart } from "@/presentation/components/MarketChart";
import { PrimaryButton } from "@/presentation/components/PrimaryButton";
import {
  useSealedMarket,
  useSealedProduct,
} from "@/application/queries/collection/useSealed";
import { routes } from "@/shared/routes";
import { useMoney } from "@/presentation/components/Price";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

const TYPE_LABEL: Record<string, string> = {
  booster_box: "Booster Box",
  booster_bundle: "Booster Bundle",
  elite_trainer_box: "Elite Trainer Box",
  collection_box: "Collection Box",
  tin: "Tin",
  blister: "Blister",
  booster_pack: "Booster Pack",
};

function prettyType(t: string): string {
  return (
    TYPE_LABEL[t] ??
    t
      .split("_")
      .map((w) => (w[0]?.toUpperCase() ?? "") + w.slice(1))
      .join(" ")
  );
}


export default function SealedDetailScreen() {
  const p = useThemedPalette();
  const { format: money } = useMoney();
  const usd = (n: number | null | undefined): string =>
    n == null || !Number.isFinite(n) ? "—" : money(n, { compact: false });
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const productQ = useSealedProduct(id);
  const marketQ = useSealedMarket(id);
  const product = productQ.data;
  const market = marketQ.data;

  const series: ChartSeries[] = useMemo(() => {
    const pts = (market?.points ?? []).filter((x) => Number.isFinite(x.price));
    if (pts.length < 2) return [];
    return [
      {
        id: "value",
        points: pts.map((x) => ({ t: Date.parse(x.ts), v: x.price })),
      },
    ];
  }, [market]);

  const headline =
    market?.market ??
    market?.mid ??
    (product?.msrp_usd != null ? Number(product.msrp_usd) : null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg.base }} edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-9 w-9 items-center justify-center rounded-full border border-line bg-bg-elevated"
        >
          <ChevronLeft size={18} color={p.ink.default} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            color: p.ink.default,
            fontSize: 15,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {product?.name ?? "Sealed product"}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {productQ.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={p.accent.mint} />
        </View>
      ) : !product ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text style={{ color: p.ink.muted }}>Couldn't load this product.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 22 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center", gap: 12 }}>
            <CardImage
              uri={product.image_url}
              width={180}
              height={180}
              rounded={16}
              contentFit="contain"
              alt={product.name}
            />
            <View style={{ alignItems: "center", gap: 4 }}>
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: 19,
                  fontWeight: "800",
                  textAlign: "center",
                }}
                numberOfLines={2}
              >
                {product.name}
              </Text>
              <Text style={{ color: p.ink.muted, fontSize: 13 }}>
                {[product.set_name, prettyType(product.product_type)]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>

          <View
            style={{
              alignItems: "center",
              paddingVertical: 14,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: p.line.default,
            }}
          >
            <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
              Market value
            </Text>
            <Text
              style={{
                color: p.ink.default,
                fontSize: 32,
                fontWeight: "800",
                letterSpacing: -1,
              }}
            >
              {usd(headline)}
            </Text>
            {product.msrp_usd != null ? (
              <Text style={{ color: p.ink.dim, fontSize: 12 }}>
                MSRP {usd(Number(product.msrp_usd))}
              </Text>
            ) : null}
          </View>

          {series.length > 0 ? (
            <View>
              <Text
                className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim"
                style={{ marginBottom: 8 }}
              >
                Value since release
              </Text>
              <MarketChart
                series={series}
                height={200}
                defaultRange="ALL"
                ranges={["3M", "6M", "1Y", "ALL"]}
                format={usd}
                // Screen pads 20 — bleed the plot to the device edges
                // (matches the card-detail + Analytics charts).
                bleedX={20}
              />
            </View>
          ) : (
            <View
              style={{
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: withAlpha(p.line.default, 0.7),
                paddingVertical: 16,
              }}
            >
              <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "800" }}>
                Value history building
              </Text>
              <Text
                style={{
                  color: p.ink.muted,
                  fontSize: 12,
                  marginTop: 4,
                  lineHeight: 18,
                }}
              >
                The value line fills in as daily market snapshots accumulate.
              </Text>
            </View>
          )}

          {market ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Tier label="Low" value={market.low} p={p} />
              <Tier label="Mid" value={market.mid} p={p} />
              <Tier label="High" value={market.high} p={p} />
            </View>
          ) : null}
        </ScrollView>
      )}

      {product ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 28,
            borderTopWidth: 1,
            borderColor: p.line.default,
            backgroundColor: p.bg.base,
          }}
        >
          <PrimaryButton
            label="Add to collection"
            icon={Plus}
            onPress={() => router.push(routes.sealedAdd(product.id))}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Tier({
  label,
  value,
  p,
}: {
  label: string;
  value: number | null;
  p: ReturnType<typeof useThemedPalette>;
}) {
  const { format: money } = useMoney();
  const usd = (n: number | null | undefined): string =>
    n == null || !Number.isFinite(n) ? "—" : money(n, { compact: false });
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: p.line.default,
        borderRadius: 14,
        padding: 12,
        gap: 2,
        backgroundColor: p.bg.elevated,
      }}
    >
      <Text style={{ color: p.ink.dim, fontSize: 11, fontWeight: "600" }}>
        {label}
      </Text>
      <Text style={{ color: p.ink.default, fontSize: 15, fontWeight: "700" }}>
        {usd(value)}
      </Text>
    </View>
  );
}
