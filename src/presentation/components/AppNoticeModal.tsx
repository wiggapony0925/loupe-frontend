import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import { useThemedPalette, withAlpha } from "@/presentation/theme/tokens";

type NoticeVariant = "info" | "success" | "warning" | "danger";

interface NoticeAction {
  label: string;
  onPress: () => void;
}

export interface AppNoticeModalProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: NoticeVariant;
  primaryAction?: NoticeAction;
  secondaryAction?: NoticeAction;
  onClose: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const ICONS: Record<NoticeVariant, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export function AppNoticeModal({
  visible,
  title,
  message,
  variant = "info",
  primaryAction,
  secondaryAction,
  onClose,
  children,
  style,
}: AppNoticeModalProps) {
  const p = useThemedPalette();
  const Icon = ICONS[variant];
  const tint =
    variant === "success"
      ? p.accent.mint
      : variant === "warning"
        ? p.accent.amber
        : variant === "danger"
          ? p.accent.rose
          : p.accent.blue;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close message"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <BlurView intensity={28} tint="dark" style={[styles.card, style]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: withAlpha(tint, 0.16),
                borderWidth: 1,
                borderColor: withAlpha(tint, 0.35),
              }}
            >
              <Icon size={20} color={tint} />
            </View>

            <View style={{ flex: 1, gap: 7 }}>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>
                {title}
              </Text>
              {message ? (
                <Text style={{ color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 20 }}>
                  {message}
                </Text>
              ) : null}
              {children}
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <X size={20} color="rgba(255,255,255,0.72)" />
            </Pressable>
          </View>

          {primaryAction || secondaryAction ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
              {secondaryAction ? (
                <NoticeButton
                  label={secondaryAction.label}
                  onPress={secondaryAction.onPress}
                  color="rgba(255,255,255,0.1)"
                  textColor="#fff"
                  borderColor="rgba(255,255,255,0.12)"
                />
              ) : null}
              {primaryAction ? (
                <NoticeButton
                  label={primaryAction.label}
                  onPress={primaryAction.onPress}
                  color={tint}
                  textColor={variant === "warning" ? "#101010" : "#fff"}
                  borderColor={tint}
                />
              ) : null}
            </View>
          ) : null}
        </BlurView>
      </View>
    </Modal>
  );
}

function NoticeButton({
  label,
  onPress,
  color,
  textColor,
  borderColor,
}: {
  label: string;
  onPress: () => void;
  color: string;
  textColor: string;
  borderColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: color,
        borderWidth: 1,
        borderColor,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: textColor, fontSize: 14, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "center",
    padding: 22,
    backgroundColor: "rgba(0,0,0,0.54)",
  },
  card: {
    overflow: "hidden",
    borderRadius: 26,
    padding: 20,
    backgroundColor: "rgba(12,14,18,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
});