import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Vitest runs alongside jest — scoped to `.vitest.ts` integration tests that
 * need MSW (whose ESM ships cleanly under Vitest but not under this project's
 * jest resolver). Jest still owns the rest (its `__tests__` suites):
 *   npm run test             -> jest (unit + component)
 *   npm run test:integration -> vitest (MSW-backed integration)
 */
export default defineConfig({
  resolve: {
    alias: [
      // Stub the native-backed observability module so node tests can import
      // the real http client without pulling in expo-constants / Sentry native.
      {
        find: "@/infrastructure/observability/sentry",
        replacement: resolve("./src/shared/test/sentryStub.ts"),
      },
      { find: "@/", replacement: resolve("./src/") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.vitest.ts"],
    setupFiles: ["./src/shared/test/vitestSetup.ts"],
  },
});
