# `src/domain/` — Domain layer

Pure types and business rules. **No React, no I/O, no side effects.**

Each subdirectory is a bounded context (DDD aggregate):

| Aggregate    | Owns                                              |
| ------------ | ------------------------------------------------- |
| `scanner/`   | Hardware status, connection transport             |
| `collection/`| User's vault — `CollectionCard`, `CardSet` enum   |
| `scan/`      | `ScanJob`, `ForensicReport`, `ForensicScore`, `HeatmapDing` |
| `capture/`   | Phone capture pipeline — `PhotometricCapture`, `OcrSuggestion`, `PhoneCaptureStep` |
| `market/`    | `PricePoint` (UI-facing simplified)               |

## Import contract

```ts
// ✅ preferred
import type { CollectionCard } from "@/domain/collection";
import type { ScanJob, ForensicReport } from "@/domain/scan";

// ❌ deprecated — kept as shim during migration
import type { CollectionCard } from "@/types/domain";
```

## Wire vs. Domain

Wire types (snake_case, mirror backend `CONTRACT.md`) live in `src/infrastructure/http/`.
Domain types (camelCase, UI-friendly) live here. Repositories at the
infrastructure boundary translate between them.
