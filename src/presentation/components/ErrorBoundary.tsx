/**
 * Top-level React error boundary.
 *
 * Catches render-time exceptions anywhere below it, reports them to Sentry
 * (when configured), and shows a minimal recovery UI. Without this, a
 * single null deref blanks out the whole app.
 *
 * Place near the root of the tree — inside `<AppProviders>` so the
 * fallback can still read theme tokens, but outside the navigator so
 * route errors don't unmount the boundary itself.
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { captureNormalizedError } from "@/infrastructure/observability/sentry";
import { palette } from "@/presentation/theme/tokens";

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback. Receives the caught error + a reset fn. */
  fallback?: (err: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    const err = error instanceof Error ? error : new Error(String(error));
    captureNormalizedError(err, {
      code: "unknown",
      message: "Render error",
      technical: info.componentStack ?? undefined,
      retryable: true,
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: palette.bg.base,
        }}
      >
        <Text
          style={{
            color: palette.ink.default,
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 8,
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            color: palette.ink.muted,
            fontSize: 13,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          The app hit an unexpected error. Tap below to try again.
        </Text>
        <Pressable
          onPress={this.reset}
          style={{
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: palette.line.default,
            backgroundColor: palette.bg.elevated,
          }}
        >
          <Text style={{ color: palette.ink.default, fontWeight: "600" }}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }
}
