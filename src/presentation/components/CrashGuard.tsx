/**
 * CrashGuard — a render error becomes a screen, not a dead app.
 *
 * In release, an uncaught JS error is FATAL: React Native tears the app
 * down with no dialog and no trace the user can report. Wrapped around a
 * feature's root, this boundary catches the throw, keeps the rest of the
 * app alive, and — the part that matters in the field — puts the actual
 * error message on screen, so a screenshot from a tester turns an opaque
 * "it crashed" into a diagnosable report.
 *
 * Only for FEATURE ROOTS (the community stack, a tab). Wrapping small
 * components would hide bugs instead of containing them.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { palette } from "@/presentation/theme/tokens";

interface Props {
  /** Names the surface in the message ("Community"). */
  label: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class CrashGuard extends React.Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error(`[CrashGuard:${this.props.label}]`, error);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // Class components can't use hooks; the module-level palette object is
    // kept current by applyTheme, which is exactly what's needed here.
    const p = palette;
    return (
      <View style={[styles.root, { backgroundColor: p.bg.base }]}>
        <AlertTriangle size={30} color={p.accent.amber} />
        <Text style={[styles.title, { color: p.ink.default }]}>
          {this.props.label} hit a problem
        </Text>
        <Text style={[styles.body, { color: p.ink.muted }]}>
          The rest of the app is fine. Screenshot this and send it to us —
          the message below is the actual error.
        </Text>
        <ScrollView
          style={[styles.trace, { backgroundColor: p.bg.elevated }]}
          contentContainerStyle={styles.traceContent}
        >
          <Text style={[styles.traceText, { color: p.ink.muted }]} selectable>
            {error.message}
            {"\n\n"}
            {error.stack?.split("\n").slice(0, 8).join("\n")}
          </Text>
        </ScrollView>
        <Pressable
          onPress={() => this.setState({ error: null })}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={[styles.retry, { backgroundColor: p.accent.mint }]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 28,
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  body: { fontSize: 13.5, lineHeight: 19, textAlign: "center" },
  trace: { maxHeight: 180, alignSelf: "stretch", borderRadius: 12, marginTop: 6 },
  traceContent: { padding: 12 },
  traceText: { fontSize: 11, lineHeight: 15, fontFamily: "Menlo" },
  retry: {
    marginTop: 10,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryText: { color: "#06140d", fontSize: 14.5, fontWeight: "800" },
});
