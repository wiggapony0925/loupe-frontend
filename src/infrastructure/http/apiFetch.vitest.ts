import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/shared/test/msw/server";
import { apiFetch, ApiError } from "@/infrastructure/http/client";

/**
 * MSW integration test (vitest): a mocked backend response flows through the
 * REAL `apiFetch` client — envelope unwrapping + error mapping — with no live
 * backend. A wildcard path matches whatever base URL the client resolves to.
 */
describe("apiFetch · MSW", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const meta = { request_id: "t", timestamp: "", version: "1", duration_ms: 1 };

  it("unwraps the envelope's `data`", async () => {
    server.use(
      http.get("*/v1/ping", () =>
        HttpResponse.json({ data: { ok: true }, meta, pagination: null, error: null }),
      ),
    );

    await expect(apiFetch("/v1/ping")).resolves.toEqual({ ok: true });
  });

  it("throws an ApiError when the envelope carries an error", async () => {
    server.use(
      http.get("*/v1/ping", () =>
        HttpResponse.json(
          {
            data: null,
            meta,
            pagination: null,
            error: { code: "not_found", message: "Nope", status: 404, field: null, details: null },
          },
          { status: 404 },
        ),
      ),
    );

    await expect(apiFetch("/v1/ping")).rejects.toBeInstanceOf(ApiError);
  });
});
