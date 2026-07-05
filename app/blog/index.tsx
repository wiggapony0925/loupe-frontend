/**
 * Blog — the Loupe blog bundled in-app (the YouTube pattern).
 *
 * Product news + collecting guides. Embedded chrome-less (`?embed=app`) in the
 * app's scheme; confined to the blog so taps stay on-topic (a post's external
 * links open the system browser via the web app's own handling).
 */
import React from "react";
import { WebPageScreen } from "@/presentation/components/WebPageScreen";

export default function BlogScreen() {
  return (
    <WebPageScreen title="Blog" path="/blog" confinePaths={["/blog"]} />
  );
}
