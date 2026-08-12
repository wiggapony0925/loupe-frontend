/**
 * The one hashtag pill.
 *
 * The rules under test: a pill without onPress is NOT a button (the draft
 * preview must stay inert), a pill with one is, and the accessibility
 * label carries the post count when there is one — a screen reader should
 * hear "#charizard, 41 posts", not two unrelated numbers.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TagPill } from "../TagPill";

describe("TagPill", () => {
  it("fires onPress and reads count into the label", () => {
    const onPress = jest.fn();
    render(<TagPill tag="charizard" count={41} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText("#charizard, 41 posts"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders as a plain view when inert", () => {
    render(<TagPill tag="psa10" />);
    expect(screen.getByText("#psa10")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("hides a zero count instead of printing it", () => {
    render(<TagPill tag="new" count={0} onPress={() => {}} />);
    expect(screen.queryByText("0")).toBeNull();
    expect(screen.getByLabelText("#new")).toBeTruthy();
  });
});
