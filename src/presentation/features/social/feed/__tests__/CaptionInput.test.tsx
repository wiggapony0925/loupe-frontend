/**
 * CaptionInput's CHILDREN CONTRACT, which nothing else covers.
 *
 * The composer renders its draft-tag pills by passing <DraftTags> as children
 * of this component (compose.tsx). DraftTags is well tested on its own and
 * TagPill is well tested on its own — but both of those pass with flying
 * colours if CaptionInput quietly stops rendering `{children}`. The pills
 * would simply disappear from the create-post screen, no error, no failing
 * test, and the caption field would look completely normal.
 *
 * That is a whole class of bug this codebase has been bitten by: every piece
 * verified in isolation, the seam between them verified nowhere. So the seam
 * gets a test.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { CaptionInput } from "../CaptionInput";

jest.mock("../HashtagRow", () => ({ HashtagRow: () => null }));

function setup(value: string, children?: React.ReactNode) {
  return render(
    <CaptionInput value={value} onChangeText={jest.fn()}>
      {children}
    </CaptionInput>,
  );
}

describe("CaptionInput", () => {
  it("renders what is passed beneath the field", () => {
    // THE SEAM. compose.tsx puts DraftTags here; if this stops rendering,
    // the create-post screen silently loses its hashtag pills.
    setup("Pulled a #charizard", <Text>the draft's pills</Text>);

    expect(screen.getByText("the draft's pills")).toBeTruthy();
  });

  it("still shows the caption itself when there are no children", () => {
    setup("Just words");

    expect(screen.getByDisplayValue("Just words")).toBeTruthy();
  });

  it("tints every token, not just the first", () => {
    // The regression this guards is subtle and real: `.test()` on a /g regex
    // advances lastIndex, so a shared regex object would leave every OTHER
    // tag unstyled. CaptionInput keeps a separate un-anchored twin for
    // exactly this reason — see TOKEN_RE / IS_TOKEN.
    setup("#one and #two and #three");

    for (const tag of ["#one", "#two", "#three"]) {
      const node = screen.getByText(tag);
      const style = Array.isArray(node.props.style)
        ? Object.assign({}, ...node.props.style.filter(Boolean))
        : (node.props.style ?? {});
      expect(style.fontWeight).toBe("600");
    }
  });

  it("labels the field for VoiceOver", () => {
    setup("");

    expect(screen.getByLabelText("Post caption")).toBeTruthy();
  });
});
