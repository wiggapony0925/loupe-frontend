#!/usr/bin/env bash
#
# Regenerate src/infrastructure/http/wire/__generated__/openapi.ts from
# the live backend schema.
#
# Why a shell wrapper: keeping the two-step pipeline (dump JSON ➜ run
# openapi-typescript) in one file lets CI invoke it without duplicating
# the paths, and makes the dev workflow a single `npm run generate:api-
# types` away.
#
# Requires the backend's virtualenv to be active so `python -m` can
# import the FastAPI app.

set -euo pipefail

FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$(cd "${FRONTEND_DIR}/../loupe-backend" && pwd)"
OUT_DIR="${FRONTEND_DIR}/src/infrastructure/http/wire/__generated__"
SCHEMA="${OUT_DIR}/openapi.json"
TYPES="${OUT_DIR}/openapi.ts"

mkdir -p "${OUT_DIR}"

echo "▶ Dumping OpenAPI schema from backend…"
(cd "${BACKEND_DIR}" && python scripts/dump_openapi.py "${SCHEMA}")

echo "▶ Generating TypeScript types…"
npx --no-install openapi-typescript "${SCHEMA}" -o "${TYPES}"

echo "✓ Wrote ${TYPES}"
