// Re-export the generated OpenAPI types under a stable barrel path so
// consumers can `import type { components, paths } from
// "@/infrastructure/http/wire/__generated__"` without reaching into
// the `openapi.ts` filename. See ./README.md for the regen workflow.

export type { components, operations, paths, webhooks } from "./openapi";
