/**
 * Population report — how many graded copies exist, by house and grade.
 *
 * Renders the canonical document's `population` block (PSA/CGC/BGS pop
 * data the backend already composes). Collectors read this constantly
 * ("how rare is a 10?"), and until now NO client surface rendered it.
 * Returns `null` when the backend had no population source for the card.
 */
import { Text, View } from "react-native";
import type {
  CanonicalCert,
  CanonicalPopulation,
} from "@/infrastructure/http/wire/canonicalCard";
import { useThemedPalette } from "@/presentation/theme/tokens";

/** Rows shown before we cut off (highest population first). */
const MAX_ROWS = 8;

export function PopulationSection({
  population,
  certs,
}: {
  population: CanonicalPopulation | null | undefined;
  certs?: CanonicalCert[] | null;
}) {
  const p = useThemedPalette();
  const certRows = certs ?? [];
  if (
    (!population || population.total <= 0 || population.rows.length === 0) &&
    certRows.length === 0
  ) {
    return null;
  }
  const popRows = population?.rows ?? [];
  const rows = [...popRows]
    .sort((a, b) => b.population - a.population)
    .slice(0, MAX_ROWS);
  const houses = Object.entries(population?.by_house ?? {}).filter(([, n]) => n > 0);
  const maxPop = rows[0]?.population ?? 1;

  return (
    <View
      style={{
        padding: 16,
        gap: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.line.default,
        backgroundColor: p.bg.elevated,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: p.ink.dim, fontSize: 10, fontWeight: "800", letterSpacing: 3 }}
        >
          POPULATION
        </Text>
        <Text style={{ color: p.ink.default, fontSize: 13, fontWeight: "800" }}>
          {(population?.total ?? 0) > 0
            ? `${population!.total.toLocaleString()} graded`
            : "Verified certs"}
        </Text>
      </View>

      {houses.length > 1 ? (
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          {houses.map(([house, n]) => (
            <Text key={house} style={{ color: p.ink.muted, fontSize: 11 }}>
              {house.toUpperCase()} {n.toLocaleString()}
            </Text>
          ))}
        </View>
      ) : null}

      {rows.map((r) => (
        <View
          key={`${r.house}-${r.grade}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <Text
            style={{ color: p.ink.default, fontSize: 12, fontWeight: "700", width: 76 }}
          >
            {r.house.toUpperCase()} {r.grade}
          </Text>
          <View
            style={{
              flex: 1,
              height: 6,
              borderRadius: 999,
              backgroundColor: p.line.default,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.max(4, (r.population / maxPop) * 100)}%`,
                height: 6,
                borderRadius: 999,
                backgroundColor: p.accent.mint,
              }}
            />
          </View>
          <Text
            style={{
              color: p.ink.muted,
              fontSize: 11,
              fontVariant: ["tabular-nums"],
              minWidth: 64,
              textAlign: "right",
            }}
          >
            {r.population.toLocaleString()}
            {r.pop_higher != null ? ` · ${r.pop_higher} ↑` : ""}
          </Text>
        </View>
      ))}

      {certRows.map((c) => (
        <View
          key={`${c.house}-${c.cert_number}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <Text style={{ color: p.ink.default, fontSize: 12, fontWeight: "700" }}>
            {c.house.toUpperCase()} #{c.cert_number}
          </Text>
          <Text style={{ color: p.ink.muted, fontSize: 11 }}>
            {[c.grade, c.subject, c.year].filter(Boolean).join(" · ") || "verified"}
          </Text>
        </View>
      ))}
    </View>
  );
}
