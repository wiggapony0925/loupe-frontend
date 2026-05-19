# `src/shared/` — Cross-cutting utilities

Framework-agnostic helpers with **no domain knowledge** and **no I/O**.
Anything in here is safe to import from any layer
(`domain`, `application`, `infrastructure`, `presentation`).

## Layout

| Module          | Purpose                                              |
| --------------- | ---------------------------------------------------- |
| `format.ts`     | Number / date / string formatters                    |
| `currency.ts`   | Currency parsing & display                           |
| `chart.ts`      | Chart-data helpers (series shaping, axis ticks)      |
| `routes.ts`     | Typed Expo Router path builders                      |
| `config.ts`     | Build-time env config (API base, version)            |
| `copy.ts`       | Centralized user-facing strings                      |
| `network.ts`    | Reachability / retry helpers                         |
| `errors.ts`     | App-level error classes (`AppError`, …)              |
| `grading.ts`    | Grade-label normalization, color mapping             |
| `brandAssets.ts`| Logo paths, brand asset URIs                         |
| `cardImage.ts`  | TCG card image URL builders                          |
| `hooks/`        | Cross-cutting React hooks (debounce, mount, callback)|

## Rules

- ❌ No imports from `@/domain`, `@/application`, `@/infrastructure`, `@/presentation`
- ❌ No React state / effects in non-`hooks/` modules
- ✅ Pure functions and primitive types only (outside `hooks/`)
