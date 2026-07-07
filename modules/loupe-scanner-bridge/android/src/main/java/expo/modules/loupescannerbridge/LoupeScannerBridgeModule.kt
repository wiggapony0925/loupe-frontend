package expo.modules.loupescannerbridge

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.URL
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min

// Native bridge for the Loupe forensic scanner hardware AND the live
// card detector that drives `LiveIdentifyFlow`.
//
// Capability parity with iOS:
//   - `analyzeCardFrame`     : NOT YET IMPLEMENTED on Android. We omit
//                              the function entirely so the JS facade's
//                              capability-detection sees `analyze: false`
//                              and the capture loop skips rect/quality
//                              gating (falls back to full-frame upload).
//                              TODO: port via OpenCV or ML Kit Document
//                              Scanner.
//   - `cropCardPerspective`  : NOT YET IMPLEMENTED. Same story.
//   - `computePerceptualHash`: IMPLEMENTED (dHash over 9×8 grayscale).
//                              This alone is enough to give Android the
//                              cache short-circuit benefit.
//   - `checkImageQuality`    : IMPLEMENTED — Laplacian-variance blur +
//                              bright-pixel glare via raw Bitmap pixels.
//
// Mirror every change in the Swift module + TS declaration.
class LoupeScannerBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LoupeScannerBridge")

    Events("onScannerStateChange", "onCaptureProgress")

    Constant("LIGHT_COUNT") { 4 }
    Constant("SUPPORTED_LIGHT_INDICES") { listOf(0, 1, 2, 3) }

    // ───── BLE / capture / haptic stubs (parity with iOS) ─────
    AsyncFunction("connectScanner") { deviceId: String ->
      mapOf(
        "id" to deviceId,
        "firmware" to "0.0.0",
        "battery" to 100,
        "connected" to true
      )
    }

    AsyncFunction("disconnectScanner") { }

    Function("isConnected") { false }

    AsyncFunction("captureFrame") { lightIndex: Int ->
      mapOf(
        "uri" to "file:///tmp/capture-$lightIndex.jpg",
        "lightIndex" to lightIndex,
        "width" to 0,
        "height" to 0
      )
    }

    Function("triggerHaptic") { _: String -> }

    // ─────────────────────────────────────────────────────────────
    //   LIVE CARD DETECTOR — Android implementation
    // ─────────────────────────────────────────────────────────────

    AsyncFunction("checkImageQuality") { uri: String, promise: Promise ->
      val bmp = loadBitmap(uri)
      if (bmp == null) {
        promise.resolve(
          mapOf(
            "blurScore" to 1.0,
            "glareScore" to 0.0,
            "alignmentOk" to false,
            "aspectOk" to false
          )
        )
        return@AsyncFunction
      }
      val analysis = downscaleForAnalysis(bmp)
      val blur = estimateBlur(analysis)
      val glare = estimateGlare(analysis)
      if (analysis !== bmp) analysis.recycle()
      bmp.recycle()
      promise.resolve(
        mapOf(
          "blurScore" to blur,
          "glareScore" to glare,
          "alignmentOk" to true,
          "aspectOk" to true
        )
      )
    }

    // dHash over a 9×8 grayscale downsample. Returns 16-char hex.
    // Tolerates small framing wobble between consecutive frames of the
    // same card; used by JS `cardHashCache` to skip the network identify
    // round-trip on cache hits.
    AsyncFunction("computePerceptualHash") { uri: String, promise: Promise ->
      val bmp = loadBitmap(uri)
      if (bmp == null) {
        promise.reject("E_BAD_URI", "Could not read image at $uri", null)
        return@AsyncFunction
      }
      val small = Bitmap.createScaledBitmap(bmp, 9, 8, true)
      val pixels = IntArray(9 * 8)
      small.getPixels(pixels, 0, 9, 0, 0, 9, 8)
      // Compare each pixel to its right neighbour (8 comparisons per
      // row × 8 rows = 64 bits). Use the green channel as a luminance
      // proxy — it's the largest contributor to perceived brightness
      // and avoids the cost of a real RGB→Y conversion.
      var bits: Long = 0L
      for (y in 0 until 8) {
        for (x in 0 until 8) {
          val left = (pixels[y * 9 + x] shr 8) and 0xff
          val right = (pixels[y * 9 + x + 1] shr 8) and 0xff
          if (left > right) {
            bits = bits or (1L shl (y * 8 + x))
          }
        }
      }
      small.recycle()
      bmp.recycle()
      promise.resolve(String.format("%016x", bits))
    }

    View(LoupeScannerBridgeView::class) {
      Prop("url") { view: LoupeScannerBridgeView, url: URL ->
        view.webView.loadUrl(url.toString())
      }
      Events("onLoad")
    }

    // Native Android camera (CameraX) — same contract as the iOS Swift
    // LoupeCameraView so the shared JS component drives both platforms.
    View(LoupeCameraView::class) {
      Name("LoupeCameraView")
      Events("onCameraReady", "onCardDetected", "onCapture", "onMountError")

      Prop("active") { view: LoupeCameraView, active: Boolean ->
        view.setActive(active)
      }
      Prop("torchEnabled") { view: LoupeCameraView, on: Boolean ->
        view.setTorch(on)
      }
      Prop("detectionEnabled") { view: LoupeCameraView, enabled: Boolean ->
        view.setDetectionEnabled(enabled)
      }
      Prop("autoCapture") { view: LoupeCameraView, on: Boolean ->
        view.setAutoCapture(on)
      }
      Prop("zoom") { view: LoupeCameraView, zoom: Double ->
        view.setZoom(zoom)
      }
      Prop("captureRequestId") { view: LoupeCameraView, id: String ->
        view.setCaptureRequest(id)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //   Helpers
  // ─────────────────────────────────────────────────────────────

  /** Accept `file://`, absolute file path, or http(s) URL. */
  private fun loadBitmap(uri: String): Bitmap? {
    return try {
      when {
        uri.startsWith("file://") -> {
          val path = Uri.parse(uri).path ?: return null
          BitmapFactory.decodeFile(path)
        }
        uri.startsWith("/") -> BitmapFactory.decodeFile(uri)
        uri.startsWith("http") -> {
          // Avoid network I/O on the JS thread; if a caller passes a
          // remote URL here it's a bug.
          null
        }
        else -> {
          val maybeFile = File(uri)
          if (maybeFile.exists()) BitmapFactory.decodeFile(maybeFile.absolutePath) else null
        }
      }
    } catch (_: Throwable) {
      null
    }
  }

  /** Downscale to a 512px long edge for blur/glare analysis. */
  private fun downscaleForAnalysis(bmp: Bitmap): Bitmap {
    val longEdge = max(bmp.width, bmp.height)
    if (longEdge <= 512) return bmp
    val scale = 512.0 / longEdge
    val w = (bmp.width * scale).toInt().coerceAtLeast(1)
    val h = (bmp.height * scale).toInt().coerceAtLeast(1)
    return Bitmap.createScaledBitmap(bmp, w, h, true)
  }

  /**
   * Laplacian-variance blur estimator, normalised to [0,1] with the
   * same calibration as the iOS path: log10(variance) mapped from
   * sharp=-1.7 to blurry=-3.3.
   */
  private fun estimateBlur(bmp: Bitmap): Double {
    val w = bmp.width
    val h = bmp.height
    if (w < 3 || h < 3) return 0.5
    val pixels = IntArray(w * h)
    bmp.getPixels(pixels, 0, w, 0, 0, w, h)
    // 3×3 Laplacian: [[0,-1,0],[-1,4,-1],[0,-1,0]] over the green channel.
    // We collect mean + mean-of-squares to compute variance in one pass.
    var sum = 0.0
    var sumSq = 0.0
    var count = 0L
    for (y in 1 until h - 1) {
      val rowBase = y * w
      for (x in 1 until w - 1) {
        val c = ((pixels[rowBase + x] shr 8) and 0xff)
        val up = ((pixels[rowBase - w + x] shr 8) and 0xff)
        val dn = ((pixels[rowBase + w + x] shr 8) and 0xff)
        val lt = ((pixels[rowBase + x - 1] shr 8) and 0xff)
        val rt = ((pixels[rowBase + x + 1] shr 8) and 0xff)
        val lap = (4 * c - up - dn - lt - rt).toDouble() / 255.0
        sum += lap
        sumSq += lap * lap
        count++
      }
    }
    if (count == 0L) return 0.5
    val mean = sum / count
    val variance = (sumSq / count) - (mean * mean)
    if (variance <= 0.0) return 1.0
    val logV = log10(variance)
    val sharp = -1.7
    val blurry = -3.3
    val score = (sharp - logV) / (sharp - blurry)
    return min(1.0, max(0.0, score))
  }

  /** Fraction of pixels brighter than 0.95 luminance. */
  private fun estimateGlare(bmp: Bitmap): Double {
    val w = bmp.width
    val h = bmp.height
    val pixels = IntArray(w * h)
    bmp.getPixels(pixels, 0, w, 0, 0, w, h)
    var bright = 0
    val threshold = (0.95 * 255).toInt()
    for (p in pixels) {
      val r = (p shr 16) and 0xff
      val g = (p shr 8) and 0xff
      val b = p and 0xff
      // Rec. 709 luma — good enough; we only care about a threshold.
      val y = (0.2126 * r + 0.7152 * g + 0.0722 * b).toInt()
      if (y >= threshold) bright++
    }
    return bright.toDouble() / pixels.size
  }
}
