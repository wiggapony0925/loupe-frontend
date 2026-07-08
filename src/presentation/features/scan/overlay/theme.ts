/**
 * Camera-overlay material system — shared by every scanner surface
 * (the expo-camera `LiveIdentifyFlow` and the Swift/Kotlin native
 * `LoupeCameraView` screen). A scanner always renders over a live (dark)
 * camera feed regardless of the app theme, so these are intentionally
 * fixed dark-glass values — one consistent material instead of a grab-bag
 * of one-off rgba()s.
 *
 * GLASS         = the tint painted OVER a BlurView on floating pills/controls.
 * GLASS_STRONG  = solid, for result/tray cards where dense text needs
 *                 guaranteed contrast over busy card art.
 * HAIRLINE      = the crisp edge separating a control from the camera behind it.
 */
export const GLASS = "rgba(18,20,25,0.42)";
export const GLASS_STRONG = "rgba(9,11,14,0.96)";
export const HAIRLINE = "rgba(255,255,255,0.16)";
export const BLUR_INTENSITY = 46;
