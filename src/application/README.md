# `src/application/` — Application layer

Use cases that compose **domain** entities and call **infrastructure**
repositories. React-aware (hooks, stores) but never owns I/O.

| Subdir       | Responsibility                                                      |
| ------------ | ------------------------------------------------------------------- |
| `queries/`   | TanStack Query hooks + `queryKeys` factory + `queryClient` singleton |
| `stores/`    | Zustand client-state slices                                         |

## Future subdirs (Phase 4+)

| Subdir       | Will own                                                            |
| ------------ | ------------------------------------------------------------------- |
| `scan/`      | Scan-job orchestration (`useScanJob`, `useScanner`, …)              |
| `capture/`   | Phone-capture state machine (`usePhoneCapture`, `captureSteps`, …)  |
| `collection/`| Collection use cases (`useFilteredCollection`, …)                   |

## Import rules

- ✅ `application/*` may import from `@/domain/*` and `@/infrastructure/*`
- ❌ `application/*` must **not** import from `@/presentation/*`
