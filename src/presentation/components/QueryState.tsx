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
        className="items-center rounded-2xl border px-4 py-6"
        style={{
          borderColor: withAlpha(p.accent.rose, 0.4),
          backgroundColor: withAlpha(p.accent.rose, 0.06),
        }}
      >
        <Text className="text-sm font-semibold text-ink">{errorMessage}</Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            hitSlop={8}
            className="mt-2 rounded-full px-3 py-1.5"
            style={{ backgroundColor: withAlpha(p.accent.mint, 0.15) }}
          >
            <Text
              style={{
                color: p.accent.mint,
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 0.5,
              }}
            >
              RETRY
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
          <View className="items-center rounded-2xl border border-line bg-bg-elevated px-4 py-8">
            <Text className="text-sm font-semibold text-ink">{emptyTitle}</Text>
            {emptyMessage ? (
              <Text className="mt-1 text-center text-[11px] text-ink-muted">
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
