import ExpoModulesCore
import Vision
import CoreImage
import UIKit

// Native bridge for the Loupe forensic scanner hardware AND the live
// card detector that drives `LiveIdentifyFlow`.
//
// The BLE / photometric capture surface (connectScanner, captureFrame,
// triggerHaptic) is still stubbed pending the physical scanner. The
// `analyzeCardFrame` + `cropCardPerspective` methods, however, are
// fully implemented — they're what the camera screen calls on every
// preview frame to (a) reject blurry/glared frames before burning a
// network round-trip and (b) crop+deskew the card so we upload ~30KB
// instead of ~200KB. See `src/infrastructure/native/cardDetector.ts`
// for the JS facade.
//
// Mirror every change in:
//   - Android counterpart .../LoupeScannerBridgeModule.kt
//   - TS declaration ../src/LoupeScannerBridgeModule.ts
public class LoupeScannerBridgeModule: Module {
  // Re-used across calls; CIContext is expensive to allocate. Backed by
  // Metal automatically when available, which is every device we care
  // about (iPhone 8+).
  private lazy var ciContext: CIContext = {
    if let device = MTLCreateSystemDefaultDevice() {
      return CIContext(mtlDevice: device, options: [.cacheIntermediates: false])
    }
    return CIContext(options: [.cacheIntermediates: false])
  }()

  public func definition() -> ModuleDefinition {
    Name("LoupeScannerBridge")

    Events("onScannerStateChange", "onCaptureProgress")

    Constant("LIGHT_COUNT") { 4 }
    Constant("SUPPORTED_LIGHT_INDICES") { [0, 1, 2, 3] }

    // ───── BLE device lifecycle (CoreBluetooth) — stubs ─────
    AsyncFunction("connectScanner") { (deviceId: String) -> [String: Any] in
      return [
        "id": deviceId,
        "firmware": "0.0.0",
        "battery": 100,
        "connected": true
      ]
    }

    AsyncFunction("disconnectScanner") { () -> Void in }

    Function("isConnected") { () -> Bool in false }

    AsyncFunction("captureFrame") { (lightIndex: Int) -> [String: Any] in
      return [
        "uri": "file:///tmp/capture-\(lightIndex).jpg",
        "lightIndex": lightIndex,
        "width": 0,
        "height": 0
      ]
    }

    Function("triggerHaptic") { (_: String) -> Void in }

    // ─────────────────────────────────────────────────────────────────
    //   LIVE CARD DETECTOR — real implementation
    // ─────────────────────────────────────────────────────────────────

    // Returns the card-shaped rectangle (if any) plus a quality report
    // for the supplied JPEG/HEIC frame. All numeric scores are in [0,1].
    //
    // Corners (when present) are returned in image-coordinate pixel
    // space, ordered [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y],
    // top-left origin (matches what the JS perspective-crop helper
    // expects).
    //
    // Designed to be cheap enough to run on every preview frame
    // (~10-20ms on iPhone 12+). We downscale to a 512px long edge
    // before running Vision; rectangle detection accuracy on a card
    // is identical at that resolution but ~6x faster.
    AsyncFunction("analyzeCardFrame") { (uri: String, promise: Promise) in
      guard let url = self.fileURL(from: uri),
            let original = CIImage(contentsOf: url) else {
        promise.reject("E_BAD_URI", "Could not read image at \(uri)")
        return
      }

      let originalExtent = original.extent
      let longEdge = max(originalExtent.width, originalExtent.height)
      // Downscale to 512px long edge for analysis. We map detected
      // corners back to the original coordinate space before returning
      // so the JS crop helper operates on the full-res frame.
      let analysisLongEdge: CGFloat = 512
      let scale = longEdge > analysisLongEdge ? analysisLongEdge / longEdge : 1.0
      let scaled = scale < 1
        ? original.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        : original

      // ── Rectangle detection ─────────────────────────────────────
      // Trading cards are 2.5 × 3.5 in = aspect 0.714. We bracket
      // generously to allow tilt / partial occlusion: 0.55–0.95.
      // Two-pass: the strict pass wants a close, confident card; when it
      // misses we retry once with a looser floor so a card held further
      // from the phone (or at a harder angle) still gets outlined —
      // shutter captures are deliberate, so a slightly less confident
      // quad beats no crop at all.
      func detectRectangle(minSize: Float, minConfidence: Float) -> VNRectangleObservation? {
        let request = VNDetectRectanglesRequest()
        request.minimumAspectRatio = 0.55
        request.maximumAspectRatio = 0.95
        request.minimumSize = minSize
        request.maximumObservations = 1
        request.minimumConfidence = minConfidence
        request.quadratureTolerance = 25
        let handler = VNImageRequestHandler(ciImage: scaled, options: [:])
        guard (try? handler.perform([request])) != nil else { return nil }
        return (request.results as? [VNRectangleObservation])?.first
      }

      // A detection miss leaves corners nil — the caller still gets the
      // blur/glare assessment so it can decide what to do (e.g. show a
      // framing hint).
      var corners: [Double]? = nil
      var confidence: Double = 0
      var aspectOk = false
      let detected = detectRectangle(minSize: 0.25, minConfidence: 0.6)
        ?? detectRectangle(minSize: 0.12, minConfidence: 0.45)
      if let rect = detected {
        confidence = Double(rect.confidence)
        // Vision returns normalised [0,1] corners with origin at
        // bottom-left. Flip Y and scale back to the ORIGINAL image
        // pixel space so JS can crop the high-res source.
        let w = originalExtent.width
        let h = originalExtent.height
        func denorm(_ p: CGPoint) -> CGPoint {
          return CGPoint(x: p.x * w, y: (1.0 - p.y) * h)
        }
        let tl = denorm(rect.topLeft)
        let tr = denorm(rect.topRight)
        let br = denorm(rect.bottomRight)
        let bl = denorm(rect.bottomLeft)
        corners = [
          Double(tl.x), Double(tl.y),
          Double(tr.x), Double(tr.y),
          Double(br.x), Double(br.y),
          Double(bl.x), Double(bl.y)
        ]
        // Sanity check: detected aspect close to a card.
        let widthPx = hypot(tr.x - tl.x, tr.y - tl.y)
        let heightPx = hypot(bl.x - tl.x, bl.y - tl.y)
        let detectedAspect = widthPx > 0
          ? Double(min(widthPx, heightPx) / max(widthPx, heightPx))
          : 0
        aspectOk = detectedAspect >= 0.55 && detectedAspect <= 0.95
      }

      // ── Blur via Laplacian variance ─────────────────────────────
      let blurScore = self.estimateBlur(scaled)

      // ── Glare via bright-pixel fraction ─────────────────────────
      let glareScore = self.estimateGlare(scaled)

      // ── Alignment: card centred & filling >= 18% of frame ───────
      var alignmentOk = false
      if let c = corners {
        let xs = [c[0], c[2], c[4], c[6]]
        let ys = [c[1], c[3], c[5], c[7]]
        let cx = xs.reduce(0, +) / 4
        let cy = ys.reduce(0, +) / 4
        let dx = abs(cx - Double(originalExtent.width) / 2) / Double(originalExtent.width)
        let dy = abs(cy - Double(originalExtent.height) / 2) / Double(originalExtent.height)
        let widthPx = (xs.max() ?? 0) - (xs.min() ?? 0)
        let heightPx = (ys.max() ?? 0) - (ys.min() ?? 0)
        let cardArea = widthPx * heightPx
        let frameArea = Double(originalExtent.width) * Double(originalExtent.height)
        let fill = cardArea / frameArea
        alignmentOk = dx < 0.20 && dy < 0.20 && fill > 0.18
      }

      promise.resolve([
        "corners": corners as Any,
        "confidence": confidence,
        "blurScore": blurScore,
        "glareScore": glareScore,
        "alignmentOk": alignmentOk,
        "aspectOk": aspectOk,
        "imageWidth": Double(originalExtent.width),
        "imageHeight": Double(originalExtent.height)
      ])
    }

    // Perspective-warps the source image to a rectified card given the
    // 4 corner points returned by `analyzeCardFrame`, writes a JPEG to
    // the app's temp dir, and returns the new URI + dimensions.
    AsyncFunction("cropCardPerspective") {
      (uri: String, corners: [Double], outputLongEdge: Int, jpegQuality: Double, promise: Promise) in
      guard corners.count == 8 else {
        promise.reject("E_BAD_CORNERS", "Expected 8 numbers, got \(corners.count)")
        return
      }
      guard let url = self.fileURL(from: uri),
            let source = CIImage(contentsOf: url) else {
        promise.reject("E_BAD_URI", "Could not read image at \(uri)")
        return
      }

      // CIPerspectiveCorrection expects bottom-left origin, so flip Y.
      let h = source.extent.height
      func point(_ ix: Int) -> CGPoint {
        return CGPoint(x: corners[ix * 2], y: h - corners[ix * 2 + 1])
      }
      let topLeft = point(0)
      let topRight = point(1)
      let bottomRight = point(2)
      let bottomLeft = point(3)

      guard let filter = CIFilter(name: "CIPerspectiveCorrection") else {
        promise.reject("E_NO_FILTER", "CIPerspectiveCorrection unavailable")
        return
      }
      filter.setValue(source, forKey: kCIInputImageKey)
      filter.setValue(CIVector(cgPoint: topLeft), forKey: "inputTopLeft")
      filter.setValue(CIVector(cgPoint: topRight), forKey: "inputTopRight")
      filter.setValue(CIVector(cgPoint: bottomRight), forKey: "inputBottomRight")
      filter.setValue(CIVector(cgPoint: bottomLeft), forKey: "inputBottomLeft")

      guard let warped = filter.outputImage else {
        promise.reject("E_WARP_FAIL", "Perspective filter returned nil")
        return
      }

      let warpedExtent = warped.extent
      let longEdge = max(warpedExtent.width, warpedExtent.height)
      let target = CGFloat(max(outputLongEdge, 240))
      let scale = longEdge > target ? target / longEdge : 1.0
      let finalImg = scale < 1
        ? warped.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        : warped

      guard let cgImage = self.ciContext.createCGImage(finalImg, from: finalImg.extent) else {
        promise.reject("E_RENDER_FAIL", "Could not render warped image")
        return
      }
      let uiImage = UIImage(cgImage: cgImage)
      let quality = CGFloat(max(0.2, min(jpegQuality, 1.0)))
      guard let data = uiImage.jpegData(compressionQuality: quality) else {
        promise.reject("E_JPEG_FAIL", "Could not encode JPEG")
        return
      }

      let outURL = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent("card-crop-\(UUID().uuidString.prefix(8)).jpg")
      do {
        try data.write(to: outURL, options: .atomic)
      } catch {
        promise.reject("E_WRITE_FAIL", "Could not write JPEG: \(error.localizedDescription)")
        return
      }
      promise.resolve([
        "uri": outURL.absoluteString,
        "width": Double(finalImg.extent.width),
        "height": Double(finalImg.extent.height),
        "bytes": data.count
      ])
    }

    // Keep the legacy 4-field helper so existing JS callers don't break.
    AsyncFunction("checkImageQuality") { (uri: String) -> [String: Any] in
      guard let url = self.fileURL(from: uri),
            let img = CIImage(contentsOf: url) else {
        return [
          "blurScore": 1.0,
          "glareScore": 0.0,
          "alignmentOk": false,
          "aspectOk": false
        ]
      }
      return [
        "blurScore": self.estimateBlur(img),
        "glareScore": self.estimateGlare(img),
        "alignmentOk": true,
        "aspectOk": true
      ]
    }

    // On-device text recognition via Apple's Vision framework
    // (VNRecognizeTextRequest, accurate mode). This is the first-party
    // replacement for the third-party ML Kit dependency on iOS: it ships
    // with the OS, needs no extra native pod, and reads card titles /
    // set codes well. Language correction is OFF on purpose — card names
    // are proper nouns ("Charizard", "SWSH050") that autocorrect mangles.
    //
    // Used by the identify budget-fallback path: when the server skips
    // paid OCR, the client reads the frame locally and resubmits text.
    // Resolves (never rejects) with empty text on failure so callers can
    // degrade gracefully.
    AsyncFunction("recognizeCardText") { (uri: String, promise: Promise) in
      guard let url = self.fileURL(from: uri),
            let source = CIImage(contentsOf: url) else {
        promise.resolve(["text": "", "confidence": 0.0, "lineCount": 0])
        return
      }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-US"]
      let handler = VNImageRequestHandler(ciImage: source, options: [:])
      do {
        try handler.perform([request])
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        var lines: [String] = []
        var confidenceSum = 0.0
        for observation in observations {
          guard let candidate = observation.topCandidates(1).first else { continue }
          let trimmed = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
          if trimmed.isEmpty { continue }
          lines.append(trimmed)
          confidenceSum += Double(candidate.confidence)
        }
        let confidence = lines.isEmpty ? 0.0 : confidenceSum / Double(lines.count)
        promise.resolve([
          "text": lines.joined(separator: "\n"),
          "confidence": confidence,
          "lineCount": lines.count
        ])
      } catch {
        promise.resolve(["text": "", "confidence": 0.0, "lineCount": 0])
      }
    }

    // Difference-hash (dHash) over a 9×8 grayscale downsample of the
    // supplied image, returned as a 16-char hex string (64 bits). Used
    // by the JS `cardHashCache` to skip the identify network round-trip
    // when the user is hovering over a card we've already recognized in
    // this session.
    //
    // Why dHash (and not pHash):
    //   - No DCT required; ~5ms end-to-end on iPhone 12.
    //   - Tolerates the small lighting / framing wobble that happens
    //     between consecutive frames of the same card, which is exactly
    //     the workload here (we hash AFTER perspective correction so
    //     orientation is already normalized).
    //   - Hamming distance correlates well with "is this the same card"
    //     for our crops; empirically ≤ 4 = same card, ≥ 12 = different.
    AsyncFunction("computePerceptualHash") { (uri: String, promise: Promise) in
      guard let url = self.fileURL(from: uri),
            let source = CIImage(contentsOf: url) else {
        promise.reject("E_BAD_URI", "Could not read image at \(uri)")
        return
      }

      // Downscale to exactly 9×8 grayscale. We render via CIContext into
      // an 8-bit grayscale bitmap so we can read luminance directly.
      let extent = source.extent
      let sx = 9.0 / extent.width
      let sy = 8.0 / extent.height
      let scaled = source.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
      guard let mono = CIFilter(name: "CIPhotoEffectMono") else {
        promise.reject("E_NO_FILTER", "CIPhotoEffectMono unavailable")
        return
      }
      mono.setValue(scaled, forKey: kCIInputImageKey)
      guard let monoOut = mono.outputImage else {
        promise.reject("E_HASH_FAIL", "Mono filter returned nil")
        return
      }

      var pixels = [UInt8](repeating: 0, count: 9 * 8 * 4)
      let renderRect = CGRect(x: 0, y: 0, width: 9, height: 8)
      self.ciContext.render(
        monoOut,
        toBitmap: &pixels,
        rowBytes: 9 * 4,
        bounds: renderRect,
        format: .RGBA8,
        colorSpace: CGColorSpace(name: CGColorSpace.sRGB)
      )

      // dHash: for each row, compare each pixel to its right neighbour.
      // 8 rows × 8 comparisons = 64 bits. We use the red channel as the
      // luminance proxy since we already pushed through CIPhotoEffectMono
      // (R=G=B after the filter).
      var bits: UInt64 = 0
      for y in 0..<8 {
        for x in 0..<8 {
          let leftIdx = (y * 9 + x) * 4
          let rightIdx = (y * 9 + x + 1) * 4
          if pixels[leftIdx] > pixels[rightIdx] {
            bits |= 1 << UInt64(y * 8 + x)
          }
        }
      }
      promise.resolve(String(format: "%016llx", bits))
    }


    View(LoupeScannerBridgeView.self) {
      Prop("url") { (view: LoupeScannerBridgeView, url: URL) in
        if view.webView.url != url {
          view.webView.load(URLRequest(url: url))
        }
      }
      Events("onLoad")
    }

    // ─────────────────────────────────────────────────────────────────
    //   NATIVE CAMERA VIEW — AVFoundation preview + live Vision reticle
    // ─────────────────────────────────────────────────────────────────
    View(LoupeCameraView.self) {
      // Pin the exported view name so JS `requireNativeView("LoupeScannerBridge",
      // "LoupeCameraView")` resolves deterministically instead of relying on
      // the type-name fallback (which can drift under Swift name-mangling).
      ViewName("LoupeCameraView")
      Events("onCameraReady", "onCardDetected", "onCapture", "onMountError")

      Prop("active") { (view: LoupeCameraView, active: Bool) in
        view.setActive(active)
      }
      Prop("torchEnabled") { (view: LoupeCameraView, on: Bool) in
        view.setTorch(on)
      }
      Prop("detectionEnabled") { (view: LoupeCameraView, enabled: Bool) in
        view.setDetectionEnabled(enabled)
      }
      Prop("autoCapture") { (view: LoupeCameraView, on: Bool) in
        view.setAutoCapture(on)
      }
      Prop("zoom") { (view: LoupeCameraView, zoom: Double) in
        view.setZoom(zoom)
      }
      // Prop-driven capture: set a fresh id to fire a still; the result
      // arrives on `onCapture` carrying the same id.
      Prop("captureRequestId") { (view: LoupeCameraView, id: String) in
        view.setCaptureRequest(id)
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  //   Helpers
  // ─────────────────────────────────────────────────────────────────

  private func fileURL(from uri: String) -> URL? {
    if uri.hasPrefix("file://") {
      return URL(string: uri)
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri)
    }
    return URL(string: uri)
  }

  // Laplacian-variance blur estimator, normalised to [0,1]. The raw
  // variance from a sharp card photo is usually 0.005-0.02; from a
  // motion-blurred frame it's 0.0001-0.001. We map log10 of the
  // variance to a [0,1] score where 0 is sharp and 1 is unusable.
  private func estimateBlur(_ image: CIImage) -> Double {
    guard let mono = CIFilter(name: "CIPhotoEffectMono") else { return 0.5 }
    mono.setValue(image, forKey: kCIInputImageKey)
    guard let monoOut = mono.outputImage else { return 0.5 }

    let kernel: [CGFloat] = [
      0, -1, 0,
      -1, 4, -1,
      0, -1, 0
    ]
    guard let conv = CIFilter(name: "CIConvolution3X3") else { return 0.5 }
    conv.setValue(monoOut, forKey: kCIInputImageKey)
    conv.setValue(CIVector(values: kernel, count: 9), forKey: "inputWeights")
    conv.setValue(NSNumber(value: 0.0), forKey: "inputBias")
    guard let lap = conv.outputImage else { return 0.5 }

    guard let mul = CIFilter(name: "CIMultiplyCompositing") else { return 0.5 }
    mul.setValue(lap, forKey: kCIInputImageKey)
    mul.setValue(lap, forKey: kCIInputBackgroundImageKey)
    guard let squared = mul.outputImage else { return 0.5 }

    let extent = image.extent
    guard let avg = CIFilter(name: "CIAreaAverage") else { return 0.5 }
    avg.setValue(squared, forKey: kCIInputImageKey)
    avg.setValue(CIVector(cgRect: extent), forKey: kCIInputExtentKey)
    guard let avgOut = avg.outputImage else { return 0.5 }

    var px = [UInt8](repeating: 0, count: 4)
    self.ciContext.render(
      avgOut,
      toBitmap: &px,
      rowBytes: 4,
      bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
      format: .RGBA8,
      colorSpace: nil
    )
    let variance = Double(px[0]) / 255.0
    if variance <= 0 { return 1.0 }
    let logV = log10(variance)
    let blurry: Double = -3.3
    let sharp: Double = -1.7
    let score = (sharp - logV) / (sharp - blurry)
    return max(0, min(1, score))
  }

  // Glare = fraction of pixels brighter than 0.95 luminance.
  private func estimateGlare(_ image: CIImage) -> Double {
    guard let mono = CIFilter(name: "CIPhotoEffectMono") else { return 0 }
    mono.setValue(image, forKey: kCIInputImageKey)
    guard let monoOut = mono.outputImage else { return 0 }

    guard let bias = CIFilter(name: "CIColorMatrix") else { return 0 }
    bias.setValue(monoOut, forKey: kCIInputImageKey)
    bias.setValue(CIVector(x: 20, y: 0, z: 0, w: 0), forKey: "inputRVector")
    bias.setValue(CIVector(x: 0, y: 20, z: 0, w: 0), forKey: "inputGVector")
    bias.setValue(CIVector(x: 0, y: 0, z: 20, w: 0), forKey: "inputBVector")
    bias.setValue(CIVector(x: 0, y: 0, z: 0, w: 1), forKey: "inputAVector")
    bias.setValue(CIVector(x: -19, y: -19, z: -19, w: 0), forKey: "inputBiasVector")
    guard let thresh = bias.outputImage?.clampedToExtent() else { return 0 }

    let extent = image.extent
    guard let avg = CIFilter(name: "CIAreaAverage") else { return 0 }
    avg.setValue(thresh, forKey: kCIInputImageKey)
    avg.setValue(CIVector(cgRect: extent), forKey: kCIInputExtentKey)
    guard let avgOut = avg.outputImage else { return 0 }

    var px = [UInt8](repeating: 0, count: 4)
    self.ciContext.render(
      avgOut,
      toBitmap: &px,
      rowBytes: 4,
      bounds: CGRect(x: 0, y: 0, width: 1, height: 1),
      format: .RGBA8,
      colorSpace: nil
    )
    return Double(px[0]) / 255.0
  }
}
