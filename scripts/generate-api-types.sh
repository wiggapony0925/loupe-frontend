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

# Prefer the backend's own venv: a bare `python` is not on PATH on macOS
# (only python3), so this step failed with "command not found" and the
# contract fixture silently went stale.
BACKEND_PY="${BACKEND_DIR}/.venv/bin/python"
if [ ! -x "${BACKEND_PY}" ]; then
  BACKEND_PY="$(command -v python3 || command -v python || true)"
fi
[ -x "${BACKEND_PY}" ] || { echo "No Python found for the backend schema dump." >&2; exit 1; }

echo "▶ Dumping OpenAPI schema from backend… (${BACKEND_PY})"
(cd "${BACKEND_DIR}" && "${BACKEND_PY}" scripts/dump_openapi.py "${SCHEMA}")

echo "▶ Generating TypeScript types…"
npx --no-install openapi-typescript "${SCHEMA}" -o "${TYPES}"

echo "✓ Wrote ${TYPES}"
