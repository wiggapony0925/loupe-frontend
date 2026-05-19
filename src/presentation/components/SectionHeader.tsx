import React, { type ReactNode } from "react";
import { Text, View } from "react-native";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  trailing?: ReactNode;
}

export function SectionHeader({ eyebrow, title, trailing }: SectionHeaderProps) {
  return (
    <View className="mb-3 flex-row items-end justify-between">
      <View>
        {eyebrow ? (
          <Text className="text-[10px] font-semibold uppercase tracking-[3px] text-ink-dim">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="mt-1 text-lg font-semibold text-ink">{title}</Text>
      </View>
      {trailing}
    </View>
  );
}
