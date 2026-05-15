// Web stub — Loupe scanner is mobile-only. The `@/native` facade falls back to
// a JS mock when this module is unavailable, so this file just exists to keep
// expo-modules autolinking happy on web.
import { registerWebModule, NativeModule } from "expo";

class LoupeScannerBridgeModule extends NativeModule {}

export default registerWebModule(LoupeScannerBridgeModule);
