import type { Meta, StoryObj } from "@storybook/react-native-web-vite";
import { Sparkline } from "./Sparkline";

function walk(start: number, n: number, drift: number, seed: number) {
  let v = start;
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: n }, () => {
    v = Math.max(1, v * (1 + (rand() - 0.5) * 0.08) + drift);
    return Number(v.toFixed(2));
  });
}

const meta = {
  title: "Mobile/Sparkline",
  component: Sparkline,
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Up: Story = {
  args: { values: walk(40, 24, 0.6, 4), width: 160, height: 48 },
};

export const Down: Story = {
  args: { values: walk(90, 24, -0.8, 9), width: 160, height: 48 },
};
