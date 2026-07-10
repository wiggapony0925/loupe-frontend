/**
 * QueryState — common loading / error / empty render scaffold.
 *
 * Wrap any TanStack-Query-backed list/section so the three async states
 * render consistently:
 *
 *   <QueryState isLoading={q.isLoading} isError={q.isError} isEmpty={!data?.length}
 *     loadingFallback={<Skeleton .../>} emptyMessage="No results">
 *     {children}
 *   </QueryState>
 */
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

export interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  /** Optional bespoke loading view; otherwise renders a spinner. */
  loadingFallback?: React.ReactNode;
  /** Optional bespoke empty view; otherwise renders a centered message. */
  emptyFallback?: React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  /** Optional retry handler for the error state. */
  onRetry?: () => void;
  /** Optional error message override (defaults to "Something went wrong"). */
  errorMessage?: string;
  children: React.ReactNode;
}

export function QueryState({
  isLoading,
  isError,
  isEmpty,
  loadingFallback,
  emptyFallback,
  emptyTitle = "Nothing here yet",
  emptyMessage,
  errorMessage = "Something went wrong",
  onRetry,
  children,
}: QueryStateProps) {
  const p = useThemedPalette();

  if (isLoading) {
    return (
      <>
        {loadingFallback ?? (
          <View className="items-center py-8">
            <ActivityIndicator size="small" color={p.accent.mint} />
          </View>
        )}
      </>
    );
  }

  if (isError) {
    return (
      <View
        style={{
          alignItems: "center",
          paddingVertical: 20,
          gap: 12,
        }}
      >
        <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>{errorMessage}</Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            hitSlop={8}
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: withAlpha(p.accent.mint, 0.15),
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text
              style={{
                color: p.accent.mint,
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 0.4,
              }}
            >
              Retry
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <>
        {emptyFallback ?? (
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <Text style={{ color: p.ink.default, fontSize: 14, fontWeight: "700" }}>{emptyTitle}</Text>
            {emptyMessage ? (
              <Text style={{ color: p.ink.muted, fontSize: 12, textAlign: "center", maxWidth: 300 }}>
                {emptyMessage}
              </Text>
            ) : null}
          </View>
        )}
      </>
    );
  }

  return <>{children}</>;
}
