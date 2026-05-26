# `__generated__/` — DO NOT EDIT BY HAND

Files in this folder are written by
`loupe-frontend/scripts/generate-api-types.sh` (mapped to
`npm run generate:api-types`). The pipeline is:

1. `python scripts/dump_openapi.py` in `loupe-backend/` builds the
   FastAPI app and serializes its OpenAPI schema to `openapi.json`.
2. `openapi-typescript` consumes that JSON and emits the strongly-typed
   `openapi.ts` containing `paths`, `components.schemas`, and the
   `operations` map.

## How to use it from wire/ clients

Hand-written wire clients in the parent folder can pull request/response
shapes off the generated `paths` object instead of redeclaring them.
Example:

```ts
import type { components } from "./__generated__";

export type GradedCardRead = components["schemas"]["GradedCardRead"];
```

That way the wire layer stays the single source of HTTP plumbing, but
the *shapes* are guaranteed to match the backend contract — any drift
fails `npm run typecheck` immediately.

## When to regenerate

After any of:

- adding/removing/renaming a FastAPI route
- changing a Pydantic schema field type, name, or optionality
- altering response_model or response status

CI should call `npm run generate:api-types` then verify the working
tree is clean. Drift = backend changed without re-running codegen, and
the typecheck job will catch downstream consumers.

## Not committed?

`openapi.json` and `openapi.ts` are tracked so consumers don't need a
Python runtime just to typecheck the frontend. Commit both after
running the generator.
