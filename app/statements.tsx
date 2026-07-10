/**
 * Statements — dedicated archive for monthly / yearly PDF portfolio statements.
 */
import React from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { CollectionSwitcher } from "@/presentation/features/collection/CollectionSwitcher";
import { ReportsSection } from "@/presentation/features/reports";
import { periodLabel } from "@/presentation/features/reports/statementFormat";
import { useStatementSummary } from "@/presentation/features/reports/useStatementSummary";
import { useThemedPalette } from "@/presentation/theme/tokens";

export default function StatementsScreen() {
  const p = useThemedPalette();
  const { loading, latestReadyMonthly, readyCount, archiveCount } =
    useStatementSummary();

  const subtitle = loading
    ? "Loading…"
    : latestReadyMonthly
      ? `${periodLabel(latestReadyMonthly)} available · ${readyCount} total`
      : archiveCount > 0
        ? `${archiveCount} statement${archiveCount === 1 ? "" : "s"} on file`
        : "Monthly PDF archive";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-bg">
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Platform.OS === "ios" ? 116 : 64,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: p.line.default,
              backgroundColor: p.bg.elevated,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <ChevronLeft size={18} color={p.ink.default} strokeWidth={2.4} />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: p.ink.dim,
                fontSize: 10,
                fontWeight: "600",
                letterSpacing: 2.5,
                textTransform: "uppercase",
              }}
            >
              Documents
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}
            >
              <Text
                style={{
                  color: p.ink.default,
                  fontSize: 28,
                  fontWeight: "700",
                  letterSpacing: -0.4,
                }}
              >
                Statements
              </Text>
              <CollectionSwitcher />
            </View>
            <Text numberOfLines={1} style={{ color: p.ink.muted, fontSize: 13, marginTop: 2 }}>
              {subtitle}
            </Text>
          </View>
        </View>

        <ReportsSection />
      </ScrollView>
    </SafeAreaView>
  );
}
