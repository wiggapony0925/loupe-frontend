/**
 * Endpoint contract test — frontend ↔ backend path parity.
 *
 * Asserts that every HTTP path declared in the frontend's `ENDPOINTS`
 * registry actually exists in the backend's OpenAPI schema. The schema
 * is regenerated from the live FastAPI app by
 * `scripts/generate-api-types.sh` (which writes `__generated__/openapi.json`),
 * so this test catches drift the moment a backend route is renamed,
 * moved, or removed — long before it ships and 404s on a device.
 *
 * This is a *static* test: it loads the committed schema JSON and the
 * `ENDPOINTS` constants. It never hits the network.
 *
 * If this test fails:
 *   1. Re-run `npm run generate:api-types` to refresh the schema, then
 *   2. Fix the offending entry in `endpoints.ts` to match the backend.
 */

import { ENDPOINTS } from "@/infrastructure/http/endpoints";
import openapi from "@/infrastructure/http/wire/__generated__/openapi.json";

/** Collapse a concrete or templated path into a normalized comparison key. */
function normalize(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      // Backend templates look like `{card_id}`; our placeholder is `__ID__`.
      /^\{.*\}$/.test(seg) || seg === "__ID__" ? "*" : seg,
    )
    .join("/");
}

/** Every HTTP path the backend documents, normalized. */
const backendPaths = new Set(
  Object.keys((openapi as { paths: Record<string, unknown> }).paths).map(normalize),
);

/**
 * Walk the ENDPOINTS tree, materializing each leaf into a concrete path.
 * String leaves are used as-is; function leaves are invoked with a
 * sentinel id so we can normalize the dynamic segment.
 */
function collectEndpointPaths(node: unknown, trail: string[] = []): { path: string; where: string }[] {
  if (typeof node === "string") {
    return [{ path: node, where: trail.join(".") }];
  }
  if (typeof node === "function") {
    // All path-builders in ENDPOINTS take a single id-like argument.
    const built = (node as (id: string) => string)("__ID__");
    return [{ path: built, where: trail.join(".") }];
  }
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
      collectEndpointPaths(v, [...trail, k]),
    );
  }
  return [];
}

// WebSocket routes are not part of the OpenAPI document, and `system`
// liveness probes are validated by the ops health check, not codegen.
const EXCLUDED_NAMESPACES = new Set(["ws"]);

describe("frontend ↔ backend endpoint contract", () => {
  const endpoints = collectEndpointPaths(ENDPOINTS).filter(
    (e) => !EXCLUDED_NAMESPACES.has(e.where.split(".")[0] ?? ""),
  );

  it("declares at least the known core endpoints", () => {
    // Guards against the collector silently returning nothing.
    expect(endpoints.length).toBeGreaterThan(20);
  });

  it.each(endpoints.map((e) => [e.where, e.path] as const))(
    "ENDPOINTS.%s (%s) exists in the backend OpenAPI schema",
    (_where, path) => {
      expect(backendPaths.has(normalize(path))).toBe(true);
    },
  );
});
