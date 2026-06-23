/**
 * openExternalUrl — the single, no-friction way to send the user to an
 * external URL (marketplace listing, comp, report download, etc.).
 *
 * Tapping a link should *open the link* — not pop an intermediate "how do
 * you want to open this?" chooser. So we go straight into the native
 * in-app browser (SFSafariViewController on iOS / Chrome Custom Tab on
 * Android), themed to match the app chrome so there's no white flash.
 * If the in-app browser can't handle the scheme we fall back to the
 * system browser via `Linking`.
 */
import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { palette } from "@/presentation/theme/tokens";

export async function openExternalUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    await WebBrowser.openBrowserAsync(url, {
      // `palette` is mutated in place by applyTheme(), so these are always
      // the current scheme's colors.
      toolbarColor: palette.bg.elevated,
      controlsColor: palette.accent.mint,
      dismissButtonStyle: "done",
      enableDefaultShareMenuItem: true,
    });
  } catch {
    await Linking.openURL(url).catch(() => undefined);
  }
}
