/**
 * The product switcher's contract.
 *
 * The rules under test: the active lane comes from the ROUTE (both screens
 * keep an instance mounted, so a per-screen prop could never animate — or
 * disagree with where you actually are), pressing the other lane navigates,
 * and pressing the lane you're already on does nothing.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router, usePathname } from "expo-router";
import { AppSwitcher } from "../AppSwitcher";

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
  usePathname: jest.fn(() => "/"),
}));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

const navigate = router.navigate as unknown as jest.Mock;
const pathname = usePathname as unknown as jest.Mock;

beforeEach(() => {
  navigate.mockClear();
});

describe("AppSwitcher", () => {
  it("marks the lane the route says you are in", () => {
    pathname.mockReturnValue("/");
    render(<AppSwitcher />);
    expect(screen.getByLabelText("Loupe")).toBeSelected();
    expect(screen.getByLabelText("Loupe Community")).not.toBeSelected();
  });

  it("follows the route into community — including its sub-pages", () => {
    pathname.mockReturnValue("/community/people");
    render(<AppSwitcher />);
    expect(screen.getByLabelText("Loupe Community")).toBeSelected();
  });

  it("navigates when the OTHER lane is pressed", () => {
    pathname.mockReturnValue("/");
    render(<AppSwitcher />);
    fireEvent.press(screen.getByLabelText("Loupe Community"));
    expect(navigate).toHaveBeenCalledWith("/community");
  });

  it("does nothing when the current lane is pressed again", () => {
    pathname.mockReturnValue("/");
    render(<AppSwitcher />);
    fireEvent.press(screen.getByLabelText("Loupe"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("honors an explicit override prop (previews, tests)", () => {
    pathname.mockReturnValue("/");
    render(<AppSwitcher active="community" />);
    expect(screen.getByLabelText("Loupe Community")).toBeSelected();
  });
});
