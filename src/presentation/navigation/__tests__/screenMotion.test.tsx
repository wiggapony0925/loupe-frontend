/**
 * The two motions, and the rule that keeps them apart.
 *
 * WHAT THIS IS FOR. Every navigator in the app already agreed that a SIDEWAYS
 * move fades — the root stack and the tab navigator both set
 * `animation: "fade"` for it. The community stack spread the drill-down push
 * across every route it owned, including the two the island treats as peers.
 * So one segmented control animated two different ways depending on which
 * segment you hit: notifications and profile faded (they live in the tab
 * group), while the feed and collectors pushed — and the pair that pushed
 * also reversed direction on the way back, because a push has a direction and
 * going home has to undo it.
 *
 * None of that is visible to a typecheck, to a render test, or to a
 * screenshot of either screen on its own. It is only visible in the move
 * BETWEEN them, which is why the rule gets asserted here rather than trusted
 * to a comment.
 */
import { PEER_TRANSITION, SCREEN_TRANSITION } from "../screenMotion";

describe("screen motion", () => {
  it("fades between peers, in both directions", () => {
    // The whole point: a fade has no direction, so out and back look the
    // same. Any *_from_* animation reintroduces the reversal.
    expect(PEER_TRANSITION.animation).toBe("fade");
    expect(String(PEER_TRANSITION.animation)).not.toMatch(/from|slide/);
  });

  it("keeps a peer swipeable", () => {
    // Collectors is reached from a floating control; taking the back gesture
    // away would strand people on it.
    expect(PEER_TRANSITION.gestureEnabled).toBe(true);
  });

  it("does NOT use the peer motion for going deeper", () => {
    // A post, a tag page and the composer are drill-downs — they keep the
    // push. If these two ever collapse into the same thing, the app loses
    // the distinction between "sideways" and "deeper" entirely.
    expect(SCREEN_TRANSITION.animation).not.toBe(PEER_TRANSITION.animation);
  });

  it("moves peers at the same speed as everything else", () => {
    // A peer switch that runs at a different duration than the island's own
    // morph reads as two animations fighting rather than one system.
    const { SCREEN_MOTION_MS } = jest.requireActual("../screenMotion");
    expect(PEER_TRANSITION.animationDuration).toBe(SCREEN_MOTION_MS);
  });
});
