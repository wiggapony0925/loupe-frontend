import React from "react";
import { View } from "react-native";
import type { Preview } from "@storybook/react-native-web-vite";

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: "#121214", padding: 24, alignItems: "flex-start" }}>
        <Story />
      </View>
    ),
  ],
};

export default preview;
