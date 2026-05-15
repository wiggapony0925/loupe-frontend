/**
 * Public surface of the `scanner` feature.
 *
 * Other features and routes import from `@/features/scanner` only —
 * never reach into individual files. This boundary lets the feature's
 * internals (hooks, helpers, components) be reorganized without churn.
 */
export { HardwareStatusWidget } from "./HardwareStatusWidget";
export { InitiateScanButton } from "./InitiateScanButton";

export { useScannerConnection } from "./useScannerConnection";
export {
  SCANNER_STAGE_LABEL,
  useScanner,
  type ScannerHookState,
  type ScannerStage,
} from "./useScanner";
export { useScanJob } from "./useScanJob";
