package expo.modules.loupescannerbridge

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL

// Native bridge for the Loupe forensic scanner hardware.
// Stub bodies below — fill in with real BluetoothGatt / CameraX / ML Kit /
// Vibrator calls. Mirror every change in the Swift module, TS declaration,
// and JS facade (src/native/scannerBridge.ts).
class LoupeScannerBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LoupeScannerBridge")

    Events("onScannerStateChange", "onCaptureProgress")

    // ───── Constants ─────
    Constant("LIGHT_COUNT") { 4 }
    Constant("SUPPORTED_LIGHT_INDICES") { listOf(0, 1, 2, 3) }

    // ───── BLE device lifecycle (android.bluetooth.le) ─────
    AsyncFunction("connectScanner") { deviceId: String ->
      // TODO: BluetoothAdapter.getRemoteDevice(deviceId).connectGatt(...)
      mapOf(
        "id" to deviceId,
        "firmware" to "0.0.0",
        "battery" to 100,
        "connected" to true
      )
    }

    AsyncFunction("disconnectScanner") {
      // TODO: gatt.disconnect() + gatt.close()
    }

    Function("isConnected") {
      // TODO: BluetoothManager.getConnectionState(device, GATT)
      false
    }

    // ───── Photometric capture (CameraX + GATT light command) ─────
    AsyncFunction("captureFrame") { lightIndex: Int ->
      // TODO: write GATT char to fire light, ImageCapture.takePicture(...),
      //       save to cacheDir, return file uri.
      mapOf(
        "uri" to "file:///tmp/capture-$lightIndex.jpg",
        "lightIndex" to lightIndex,
        "width" to 0,
        "height" to 0
      )
    }

    // ───── On-device quality check (ML Kit + OpenCV Laplacian) ─────
    AsyncFunction("checkImageQuality") { uri: String ->
      // TODO: ML Kit ObjectDetection for alignment, OpenCV Laplacian for blur,
      //       histogram peak for glare detection.
      mapOf(
        "blurScore" to 0.0,
        "glareScore" to 0.0,
        "alignmentOk" to true,
        "aspectOk" to true
      )
    }

    // ───── Haptics (Vibrator + VibrationEffect) ─────
    Function("triggerHaptic") { pattern: String ->
      // TODO: VibrationEffect.createWaveform per named pattern.
    }

    View(LoupeScannerBridgeView::class) {
      Prop("url") { view: LoupeScannerBridgeView, url: URL ->
        view.webView.loadUrl(url.toString())
      }
      Events("onLoad")
    }
  }
}
