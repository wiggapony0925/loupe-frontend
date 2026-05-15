// Reexport the native module. On web, it will be resolved to LoupeScannerBridgeModule.web.ts
// and on native platforms to LoupeScannerBridgeModule.ts
export { default } from "./src/LoupeScannerBridgeModule";
export { default as LoupeScannerBridgeView } from "./src/LoupeScannerBridgeView";
export * from "./src/LoupeScannerBridge.types";
