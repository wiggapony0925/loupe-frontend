/**
 * ProGate — declarative subscription wall. Renders `children` when the user
 * is entitled; otherwise renders the reusable `ProWall`. One consistent gate
 * for every Pro surface — no bespoke locked states per feature.
 *
 *   <ProGate feature="statements" mode="dim"><Archive /></ProGate>
 *
 * `replace` swaps the content for a wall; `dim` shows it de-emphasised and
 * non-interactive behind a floating wall (the mobile take on the web's
 * blurred "preview of value" pattern — RN has no cheap cross-platform blur,
 * so we dim instead).
 */
import React, { type ReactNode } from "react";
import { View } from "react-native";
import { useProFeature } from "./useProFeature";
import { ProWall } from "./ProWall";
import type { PaywallReason, ProFeatureKey } from "./proPlan";

export interface ProGateProps {
  feature: ProFeatureKey;
  mode?: "replace" | "dim";
  /** Override the wall's copy/CTA (defaults come from the feature catalog). */
  title?: string;
  description?: string;
  cta?: string;
  /** Override the paywall headline reason (defaults to the feature's reason). */
  reason?: PaywallReason;
  children: ReactNode;
}

export function ProGate({
  feature,
  mode = "replace",
  title,
  description,
  cta,
  reason,
  children,
}: ProGateProps) {
  const { allowed, requirePro } = useProFeature(feature);
  if (allowed) return <>{children}</>;

  const wall = (
    <ProWall
      feature={feature}
      title={title}
      description={description}
      cta={cta}
      variant={mode === "dim" ? "overlay" : "card"}
      onUpgrade={() => requirePro(reason)}
    />
  );

  if (mode === "dim") {
    return (
      <View>
        {/* De-emphasised, non-interactive preview behind the wall. */}
        <View pointerEvents="none" style={{ opacity: 0.35 }}>
          {children}
        </View>
        {wall}
      </View>
    );
  }

  return wall;
}
