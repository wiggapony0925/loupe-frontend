import { http, HttpResponse } from "msw";

/**
 * Default MSW handlers shared by the vitest integration suite. Tests override
 * per-case with `server.use(...)`.
 */
export const handlers = [
  http.get("*/v1/health", () =>
    HttpResponse.json({
      data: { status: "ok" },
      meta: { request_id: "test", timestamp: "", version: "test", duration_ms: 0 },
      pagination: null,
      error: null,
    }),
  ),
];
