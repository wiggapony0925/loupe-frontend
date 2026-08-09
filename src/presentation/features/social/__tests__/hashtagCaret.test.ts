/**
 * Caret logic behind `#` autocomplete.
 *
 * This is where every autocomplete breaks: suggesting when the caret has
 * moved on, or completing without a trailing space so the next word gets
 * swallowed into the tag.
 */
import {
  activeHashtag,
  completeHashtag,
} from "@/presentation/features/social/feed/hashtagCaret";

describe("activeHashtag", () => {
  it("fires the instant a # is typed", () => {
    // "" not null — that's the moment a suggestion helps most, so the bar
    // shows trending rather than nothing.
    expect(activeHashtag("pulled a #", 10)).toBe("");
  });

  it("narrows as the tag is typed", () => {
    expect(activeHashtag("pulled a #poke", 14)).toBe("poke");
  });

  it("stops once the tag is finished", () => {
    expect(activeHashtag("#pokemon and more", 17)).toBeNull();
  });

  it("is null when the caret isn't in a tag at all", () => {
    expect(activeHashtag("no tags here", 6)).toBeNull();
  });

  it("tracks the tag the caret is IN, not the last one typed", () => {
    const text = "#pokemon then #psa";
    expect(activeHashtag(text, text.length)).toBe("psa");
  });

  it("follows the caret backwards into an earlier tag", () => {
    expect(activeHashtag("#pokemon", 3)).toBe("po");
  });
});

describe("completeHashtag", () => {
  it("adds a trailing space so the next word isn't swallowed", () => {
    const out = completeHashtag("pulled a #poke", 14, "pokemon");
    expect(out.text).toBe("pulled a #pokemon ");
    expect(out.caret).toBe(out.text.length);
  });

  it("replaces only the fragment under the caret", () => {
    expect(completeHashtag("#pokemon and #psa", 17, "psa10").text).toBe(
      "#pokemon and #psa10 ",
    );
  });

  it("keeps whatever followed the caret", () => {
    expect(completeHashtag("#poke rest of it", 5, "pokemon").text).toBe(
      "#pokemon  rest of it",
    );
  });

  it("is a no-op when there's no # to complete", () => {
    expect(completeHashtag("plain text", 5, "pokemon").text).toBe("plain text");
  });
});
