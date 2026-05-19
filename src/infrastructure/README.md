# `src/infrastructure/` — Infrastructure layer

Adapters to the outside world. Every outbound side effect lives here.

| Subdir              | Responsibility                                              |
| ------------------- | ----------------------------------------------------------- |
| `http/`             | HTTP transport, envelope, wire types (mirror `CONTRACT.md`) |
| `repositories/`     | Domain-shaped data access (translates wire ↔ domain)        |
| `realtime/`         | WebSocket streams (scan progress, etc.)                     |
| `native/`           | Native module bridges (scanner hardware)                    |
| `storage/`          | AsyncStorage / SecureStore (token persistence)              |
| `observability/`    | Sentry, logging, tracing                                    |

## Import rules

- ✅ `infrastructure/*` may import from `@/domain/*`
- ❌ `infrastructure/*` must **not** import from `@/application/*` or `@/presentation/*`
- ❌ `domain/*` must **never** import from `infrastructure/*`

This keeps the dependency arrow pointing one way:
`presentation → application → domain ← infrastructure`
