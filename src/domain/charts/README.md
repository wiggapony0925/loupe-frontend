# `src/domain/charts`

Pure, framework-free chart logic. **Zero React, zero SVG, zero network.**

This module is the single source of truth for everything chart-related in the
app: the timeframe vocabulary the API speaks, the math that turns raw price
points into smooth SVG paths, and the deterministic fallback walks used when
real history is missing.

UI components (`PortfolioChart`, `Sparkline`, `MarketChart`, …) and TanStack
hooks (`usePortfolioHistory`, `useCardSparklines`, …) **consume** this module.
This module never imports from `presentation/`, `application/`, or
`infrastructure/`. That separation is what makes the math trivially unit-
testable in plain Node without a React Native runtime.

## Files

| File | Responsibility |
|------|----------------|
| `types.ts` | `PricePoint`, `Timeframe`, `PortfolioSeries`, `CardSparklineSeries` |
| `timeframes.ts` | The `1D / 1W / 1M / 3M / YTD / 1Y / ALL` vocabulary + validators |
| `series.ts` | `monotoneCubic`, `nearestIndex`, `clampLabelX`, `computeDelta`, `downsample`, `normalizeFlat` |
| `fallback.ts` | `seededWalk` — **fallback-only** deterministic walk, never sent to users as truth |
| `index.ts` | Barrel |

## Rules

1. **No fabricated truth.** Real data flows through `series.ts`. `fallback.ts`
   exists for visual continuity only — callers must mark its output as
   non-authoritative (e.g. don't render a `+x.xx%` delta chip from it).
2. **Pure functions.** Every export is deterministic and side-effect free.
3. **Tested.** See `__tests__/`. Adding behaviour without a test is a bug.
