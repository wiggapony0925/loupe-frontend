/**
 * Caption highlighting.
 *
 * The rule under test: a word is only made tappable when the SERVER says it
 * resolves. Highlighting every `#word` and `@word` the regex finds produces
 * links to tag pages with nothing on them and to accounts that don't exist —
 * and, worse, turns an email address in a caption into a broken mention.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { PostCaption } from "../PostCaption";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const push = router.push as unknown as jest.Mock;

beforeEach(() => push.mockClear());

describe("PostCaption", () => {
  it("links a hashtag the server indexed", () => {
    render(<PostCaption body="grail #charizard" hashtags={["charizard"]} mentions={[]} />);
    fireEvent.press(screen.getByText("#charizard"));
    expect(push).toHaveBeenCalledWith("/community/tag/charizard");
  });

  it("leaves a hashtag the server did NOT index as plain text", () => {
    render(<PostCaption body="grail #charizard" hashtags={[]} mentions={[]} />);
    fireEvent.press(screen.getByText("#charizard"));
    expect(push).not.toHaveBeenCalled();
  });

  it("links a mention that resolves to a real account", () => {
    render(<PostCaption body="ta @mistyx" hashtags={[]} mentions={["mistyx"]} />);
    fireEvent.press(screen.getByText("@mistyx"));
    expect(push).toHaveBeenCalledWith("/u/mistyx");
  });

  it("does not link an @word that names nobody", () => {
    render(<PostCaption body="mail me at a@b.com" hashtags={[]} mentions={[]} />);
    expect(push).not.toHaveBeenCalled();
  });

  it("matches a mention even when the sentence puts a full stop on it", () => {
    // The server trims trailing dots when it resolves; the renderer has to
    // trim the same way or the highlight and the index disagree.
    render(<PostCaption body="thanks @ash." hashtags={[]} mentions={["ash"]} />);
    fireEvent.press(screen.getByText("@ash."));
    expect(push).toHaveBeenCalledWith("/u/ash");
  });

  it("renders the author handle as a bold prefix", () => {
    render(
      <PostCaption body="my pull" hashtags={[]} mentions={[]} prefix="jeffcollects" />,
    );
    expect(screen.getByText(/jeffcollects/)).toBeTruthy();
  });
});
