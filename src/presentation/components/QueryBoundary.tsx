/**
 * QueryBoundary — unified wrapper around a React Query result that picks
 * the correct loading / empty / error UI for the section.
 *
 * Designed to slot in beside (or replace) the older `QueryState` helper.
 * Pass the query result + a `children` render-prop and we'll only invoke
 * it once data is loaded and non-empty.
 */

import React from "react";
import { ActivityIndicator, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { ErrorState } from "@/presentation/components/ErrorState";
import { EmptyState } from "@/presentation/components/EmptyState";
import { normalizeError } from "@/shared/errors";
import { useThemedPalette } from "@/presentation/theme/tokens";

interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch: () => unknown | Promise<unknown>;
}

interface QueryBoundaryProps<T> {
  query: QueryLike<T>;
  loading?: React.ReactNode;
  errorTitle?: string;
  errorMessage?: string;
  onRetry?: () => void;
  empty?: { title: string; message?: string; icon?: LucideIcon } | null;
  isEmpty?: (data: T) => boolean;
  emptyAction?: { label: string; onPress: () => void };
  compact?: boolean;
  children: (data: T) => React.ReactNode;
}

function defaultIsEmpty<T>(data: T): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

export function QueryBoundary<T>({
  query,
  loading,
  errorTitle,
  errorMessage,
  onRetry,
  empty,
  isEmpty,
  emptyAction,
  compact,
  children,
}: QueryBoundaryProps<T>) {
  const p = useThemedPalette();

  if (query.isLoading) {
    return (
      <>
        {loading ?? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator size="small" color={p.accent.mint} />
          </View>
        )}
      </>
    );
  }

  if (query.isError) {
    const n = normalizeError(query.error);
    return (
      <ErrorState
        title={errorTitle ?? "Couldn't load this"}
        message={errorMessage ?? n.message}
        code={n.code}
        onRetry={
          onRetry ??
          (() => {
            void query.refetch();
          })
        }
        compact={compact}
      />
    );
  }

  const data = query.data as T;
  const isEmptyResult = (isEmpty ?? defaultIsEmpty)(data);
  if (isEmptyResult) {
    if (empty === null) return null;
    return (
      <EmptyState
        title={empty?.title ?? "Nothing here yet"}
        message={empty?.message}
        icon={empty?.icon}
        secondaryActionLabel={emptyAction?.label}
        onSecondaryAction={emptyAction?.onPress}
        compact={compact}
      />
    );
  }

  return <>{children(data)}</>;
}
