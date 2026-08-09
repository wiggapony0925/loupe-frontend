/**
 * How much of the screen the keyboard is currently covering.
 *
 * `KeyboardAvoidingView` is the obvious tool and it is unreliable in the one
 * place we need it most: inside a `Modal`. It works from its own measured
 * frame, and a sheet presented in a modal is not laid out against the window
 * the way it assumes, so `behavior="padding"` lifts by the wrong amount or by
 * nothing at all. Reading the keyboard's own reported height sidesteps the
 * measurement entirely.
 *
 * iOS gets the `will` events, which fire *before* the keyboard animates and
 * carry its duration — so padding driven by this moves in step with the
 * keyboard instead of snapping after it. Android has no `will` phase; the
 * `did` events are the only ones it sends.
 */
import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, Platform } from "react-native";

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const willShow = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const willHide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(willShow, (event) => {
      if (Platform.OS === "ios") {
        // Match the keyboard's own curve and duration. Without this the
        // sheet jumps to its new size while the keyboard is still sliding.
        LayoutAnimation.configureNext({
          duration: event.duration || 250,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(event.endCoordinates.height);
    });

    const hide = Keyboard.addListener(willHide, (event) => {
      if (Platform.OS === "ios") {
        LayoutAnimation.configureNext({
          duration: event.duration || 250,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setHeight(0);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
