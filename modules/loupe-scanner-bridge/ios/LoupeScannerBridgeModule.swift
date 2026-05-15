import ExpoModulesCore

// Native bridge for the Loupe forensic scanner hardware.
// Stub bodies below — fill in with real CoreBluetooth / AVFoundation /
// Vision / Core Haptics calls. Mirror every change in:
//   - Android counterpart .../LoupeScannerBridgeModule.kt
//   - TS declaration ../src/LoupeScannerBridgeModule.ts
//   - JS facade        src/native/scannerBridge.ts
public class LoupeScannerBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LoupeScannerBridge")

    // Events emitted back to JS
    Events("onScannerStateChange", "onCaptureProgress")

    // ───── Constants ─────
    Constant("LIGHT_COUNT") { 4 }
    Constant("SUPPORTED_LIGHT_INDICES") { [0, 1, 2, 3] }

    // ───── BLE device lifecycle (CoreBluetooth) ─────
    AsyncFunction("connectScanner") { (deviceId: String) -> [String: Any] in
      // TODO: CBCentralManager.connect(peripheral:options:)
      return [
        "id": deviceId,
        "firmware": "0.0.0",
        "battery": 100,
        "connected": true
      ]
    }

    AsyncFunction("disconnectScanner") { () -> Void in
      // TODO: CBCentralManager.cancelPeripheralConnection
    }

    Function("isConnected") { () -> Bool in
      // TODO: query active CBPeripheral state
      return false
    }

    // ───── Photometric capture (AVFoundation + GATT light command) ─────
    AsyncFunction("captureFrame") { (lightIndex: Int) -> [String: Any] in
      // TODO: write GATT char to enable light at `lightIndex`,
      //       AVCapturePhotoOutput.capturePhoto(with:delegate:),
      //       persist JPEG to NSTemporaryDirectory and return file URI.
      return [
        "uri": "file:///tmp/capture-\(lightIndex).jpg",
        "lightIndex": lightIndex,
        "width": 0,
        "height": 0
      ]
    }

    // ───── On-device quality check (Vision + CoreImage) ─────
    AsyncFunction("checkImageQuality") { (uri: String) -> [String: Any] in
      // TODO: VNImageRequestHandler — VNDetectRectanglesRequest for alignment,
      //       Laplacian variance (CIFilter) for blur, mean luma for glare.
      return [
        "blurScore": 0.0,        // 0 sharp ─ 1 blurry
        "glareScore": 0.0,       // 0 none  ─ 1 heavy
        "alignmentOk": true,
        "aspectOk": true
      ]
    }

    // ───── Haptics (Core Haptics) ─────
    Function("triggerHaptic") { (pattern: String) -> Void in
      // TODO: CHHapticEngine pattern lookup by name —
      // "tick" | "success" | "warning" | "failure"
    }

    // ───── Template View (kept until we ship a real native view) ─────
    View(LoupeScannerBridgeView.self) {
      Prop("url") { (view: LoupeScannerBridgeView, url: URL) in
        if view.webView.url != url {
          view.webView.load(URLRequest(url: url))
        }
      }
      Events("onLoad")
    }
  }
}
