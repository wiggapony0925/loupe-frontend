/**
 * The draft's tag pills.
 *
 * The rules under test (aligned with the SERVER's indexer, not just the
 * caption tint): tags are lowercased and deduped, so `#Pokemon #pokemon
 * #POKEMON` promises ONE tag; single-character tags never pill because the
 * server never indexes them (`#1` in "the #1 grail" would be a broken
 * promise); an over-long run pills as its first 64 characters, exactly
 * the prefix the server keeps. And a caption with no tags renders nothing
 * at all: an empty "tags" strip under every post would read as a nag.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { DraftTags, draftTagsFrom } from "../DraftTags";

describe("draftTagsFrom", () => {
  it("dedupes case-variants down to one lowercase tag", () => {
    expect(draftTagsFrom("#Pokemon #pokemon #POKEMON")).toEqual(["pokemon"]);
  });

  it("keeps first-typed order", () => {
    expect(draftTagsFrom("pulled #charizard today #psa10 #charizard")).toEqual([
      "charizard",
      "psa10",
    ]);
  });

  it("finds nothing in a caption without tags", () => {
    expect(draftTagsFrom("mail me at a@b.com")).toEqual([]);
  });

  it("drops single-character tags, like the server does", () => {
    expect(draftTagsFrom("pulled the #1 grail")).toEqual([]);
  });

  it("caps a tag at the 64 characters the server indexes", () => {
    const run = "x".repeat(70);
    expect(draftTagsFrom(`#${run}`)).toEqual(["x".repeat(64)]);
  });
});

describe("DraftTags", () => {
  it("renders one labeled pill per distinct tag, # drawn back on", () => {
    render(<DraftTags body="grail #Charizard #charizard" />);
    expect(screen.getByText("IN THIS POST")).toBeTruthy();
    expect(screen.getByText("#charizard")).toBeTruthy();
    expect(screen.queryByText("#Charizard")).toBeNull();
  });

  it("renders nothing for a tagless caption", () => {
    render(<DraftTags body="no tags here" />);
    expect(screen.queryByText("IN THIS POST")).toBeNull();
  });

  it("is inert — a draft pill is a preview, not a link", () => {
    render(<DraftTags body="#psa10" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
