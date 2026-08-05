/**
 * Where a 404's buttons should actually go.
 *
 * Split out from the screen because the interesting part isn't the layout,
 * it's that the right destination depends on the session — and that's worth
 * testing without mounting a navigator.
 *
 * The web's 404 offers "Back home" and "Browse the market" unconditionally,
 * which is correct there: both routes are public. In the app they aren't. The
 * root layout only lets an unauthenticated visitor into `(auth)` and `legal`
 * (see `PUBLIC_SEGMENTS`), so offering a signed-out user either button sends
 * them into a guard that immediately bounces them to the welcome screen. The
 * button appears to do nothing, or worse, something random.
 *
 * So signed out we offer the one honest destination, and drop the second
 * button rather than showing a decoy.
 */
import type { Href } from "expo-router";
import { NOT_FOUND } from "@loupe/marketing";
import { routes } from "@/shared/routes";

/** `kind` lets the screen pick an icon without matching on label text. */
export interface NotFoundAction {
  kind: "home" | "signIn" | "browse";
  label: string;
  href: Href;
}

export interface NotFoundActions {
  primary: NotFoundAction;
  /** Null when signed out — the app has no public browse surface. */
  secondary: NotFoundAction | null;
}

export function notFoundActions(isAuthenticated: boolean): NotFoundActions {
  if (!isAuthenticated) {
    return {
      primary: {
        kind: "signIn",
        label: NOT_FOUND.ctaSignedOut,
        href: routes.welcome(),
      },
      secondary: null,
    };
  }

  return {
    primary: { kind: "home", label: NOT_FOUND.ctaHome, href: routes.home() },
    secondary: {
      kind: "browse",
      label: NOT_FOUND.ctaBrowse,
      href: routes.search(),
    },
  };
}
