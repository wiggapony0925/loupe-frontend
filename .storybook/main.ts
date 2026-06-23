import type { StorybookConfig } from "@storybook/react-native-web-vite";
import { dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Storybook for the mobile app, rendered in the browser via react-native-web.
 * Lets us preview the RN components (charts, etc.) without a device build.
 */
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: { name: "@storybook/react-native-web-vite", options: {} },
  viteFinal: async (cfg) => {
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      // Mirror the app's `@/` alias + the vendored @loupe/chart (Metro resolves
      // these; vite needs them spelled out).
      "@": `${root}/src`,
      "@loupe/chart": `${root}/vendor/loupe-chart/src`,
    };
    return cfg;
  },
};

export default config;
