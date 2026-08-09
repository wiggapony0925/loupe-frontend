/**
 * "Coming back to a tab should feel like coming home."
 *
 * A tab whose content is a nested Stack remembers where you were. That is
 * right for Vault (you left mid-edit; you want to be mid-edit) and wrong for
 * a social feed: tapping Community and landing on a stranger's profile, or
 * on a permalink you opened yesterday, reads as the app being stuck rather
 * than as the app being helpful.
 *
 * **Why blur and not focus.** The obvious version resets when the tab gains
 * focus — and it breaks every deep link. A notification tap navigates to
 * `/community/p/{id}`, which focuses the tab; resetting there would throw
 * the user onto the feed a frame after they asked for a post. Unwinding on
 * the way OUT means the stack is already at home before any inbound
 * navigation happens, so deep links push onto a clean stack and survive.
 *
 * Call it once, from the stack's ROOT screen. That screen stays mounted
 * underneath everything pushed on top of it, so its listener is still live
 * when the user leaves from three levels deep.
 */
import { useEffect } from "react";
import { useNavigation } from "expo-router";

/** Navigations that can unwind to their first screen. */
type Poppable = {
  popToTop?: () => void;
  canGoBack?: () => boolean;
};

export function useHomeOnReentry(): void {
  const navigation = useNavigation();

  useEffect(() => {
    // The tab (or whatever owns this stack). No parent — this stack is the
    // root, nothing can blur it, and there is nothing to do.
    const parent = navigation.getParent();
    if (!parent) return;

    return parent.addListener("blur", () => {
      const stack = navigation as unknown as Poppable;
      // `popToTop` on an already-home stack is a no-op in React Navigation,
      // but guarding keeps this from emitting a state change on every single
      // tab switch — which would re-render the feed for no reason.
      if (stack.canGoBack?.()) stack.popToTop?.();
    });
  }, [navigation]);
}
