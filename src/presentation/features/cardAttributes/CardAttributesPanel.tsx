/**
 * `<CardAttributesPanel>` — game-aware attribute renderer.
 *
 * Single entry point used by `/card/[id]` to display game-specific
 * trivia (Pokédex flavor, MTG oracle text, YGO ATK/DEF). The card
 * detail page MUST NOT branch on `tcg` itself — it just hands the
 * canonical card to this component and lets the registry decide what
 * (if anything) to render.
 *
 * To add a new TCG:
 *   1. Build a sub-panel that takes `{ canonical }` and returns null
 *      when it has nothing useful to show.
 *   2. Add an entry to `PANEL_REGISTRY` keyed by the `tcg` discriminator.
 *
 * Renders `null` (no spacing) when:
 *   - No canonical document yet (still loading or 404)
 *   - The `tcg` has no registered panel
 *   - The registered panel returns null
 */
import type { ReactElement } from "react";
import type { CanonicalCard } from "@/infrastructure/http/wire/canonicalCard";
import { GenericAttributesPanel } from "./GenericAttributesPanel";
import { MtgOraclePanel } from "./MtgOraclePanel";
import { PokemonAttributesSection } from "./PokemonAttributesPanel";
import { YugiohStatsPanel } from "./YugiohStatsPanel";

type PanelProps = { canonical: CanonicalCard };
type PanelComponent = (props: PanelProps) => ReactElement | null;

/**
 * Sub-panel registry, keyed by canonical `identity.tcg`.
 *
 * Sub-panels are leaf components — they own their own loading,
 * empty, and error states. They MUST return `null` when there's no
 * meaningful content so the parent layout doesn't render an empty
 * card.
 *
 * Unknown TCGs (Lorcana, One Piece, anything new) fall through to
 * `GenericAttributesPanel`, which renders every primitive key on
 * `canonical.attributes` as a labelled row. That way any provider
 * data lands in the UI immediately without waiting for a bespoke
 * panel build.
 */
const PANEL_REGISTRY: Readonly<Record<string, PanelComponent>> = {
  // Card stats (HP / attacks / weaknesses — the CARD's data) first, then
  // the Pokédex species flavor. Same field coverage as the web card page.
  pokemon: ({ canonical }) => <PokemonAttributesSection canonical={canonical} />,
  magic: ({ canonical }) => <MtgOraclePanel canonical={canonical} />,
  yugioh: ({ canonical }) => <YugiohStatsPanel canonical={canonical} />,
};

export function CardAttributesPanel({
  canonical,
}: {
  canonical: CanonicalCard | null | undefined;
}) {
  if (!canonical) return null;
  const Panel = PANEL_REGISTRY[canonical.identity.tcg] ?? GenericAttributesPanel;
  return <Panel canonical={canonical} />;
}
