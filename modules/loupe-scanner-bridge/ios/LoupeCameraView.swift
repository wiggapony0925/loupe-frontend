import ExpoModulesCore
import AVFoundation
import Vision
import UIKit

// Native Swift camera preview for the card scanner. Replaces the
// React-Native `expo-camera` surface with a first-party AVFoundation
// capture session, live Vision card detection, a CoreAnimation reticle
// that tracks the card in real time, and a native still capture.
//
// Everything the user sees while framing a card is drawn here in Swift:
//   • AVCaptureVideoPreviewLayer — the live camera feed
//   • VNDetectRectanglesRequest on the video buffers — finds the card
//   • CAShapeLayer overlay — a mint quad that snaps onto the card corners
//   • AVCapturePhotoOutput — the full-res capture the identify pipeline
//     uploads
//
// JS drives it through props (`active`, `torchEnabled`, `detectionEnabled`)
// and reads it through events (`onCameraReady`, `onCardDetected`,
// `onCapture`, `onMountError`). The imperative `captureCard()` lives on
// the module and forwards to the active view.
class LoupeCameraView: ExpoView, AVCaptureVideoDataOutputSampleBufferDelegate {
  // ── Events → JS ─────────────────────────────────────────────────
  let onCameraReady = EventDispatcher()
  let onCardDetected = EventDispatcher()
  let onCapture = EventDispatcher()
  let onMountError = EventDispatcher()

  // ── Capture stack ───────────────────────────────────────────────
  private let session = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "app.loupe.camera.session")
  private let videoQueue = DispatchQueue(label: "app.loupe.camera.video")
  private let photoOutput = AVCapturePhotoOutput()
  private let videoOutput = AVCaptureVideoDataOutput()
  private var previewLayer: AVCaptureVideoPreviewLayer!
  private var device: AVCaptureDevice?

  // ── Reticle overlay ─────────────────────────────────────────────
  private let reticleLayer = CAShapeLayer()

  // ── State ───────────────────────────────────────────────────────
  private var configured = false
  private var running = false
  private var detectionEnabled = true
  private var lastDetectAt: TimeInterval = 0
  private var lastCaptureRequestId: String = ""
  private var activeCaptureRequestId: String = ""
  private var capturing = false
  // Latest detection in VIEW coordinates for the reticle, and in
  // normalized Vision space for the crop math on capture.
  private var lastNormalizedCorners: [CGPoint]?

  // ── Auto-capture / steadiness ───────────────────────────────────
  // A pro scanner captures itself when the card is well-framed and held
  // still. We track how many consecutive frames the card's centroid has
  // barely moved; once it's steady + confident + filling enough of the
  // frame for `autoSteadyFrames`, we auto-fire a capture.
  private var autoCapture = false
  private var steadyStreak = 0
  private var lastCentroid: CGPoint?
  private var lastAutoCaptureAt: TimeInterval = 0
  private let autoSteadyFrames = 5
  private let autoCaptureCooldown: TimeInterval = 2.5
  private var pendingZoom: CGFloat = 1.0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    setupPreview()
    setupReticle()
  }

  // MARK: - Layout

  private func setupPreview() {
    previewLayer = AVCaptureVideoPreviewLayer(session: session)
    previewLayer.videoGravity = .resizeAspectFill
    layer.addSublayer(previewLayer)
  }

  private func setupReticle() {
    reticleLayer.fillColor = UIColor(red: 0.086, green: 0.753, blue: 0.612, alpha: 0.12).cgColor
    reticleLayer.strokeColor = UIColor(red: 0.086, green: 0.753, blue: 0.612, alpha: 0.95).cgColor
    reticleLayer.lineWidth = 2.5
    reticleLayer.lineJoin = .round
    reticleLayer.shadowColor = UIColor(red: 0.086, green: 0.753, blue: 0.612, alpha: 1).cgColor
    reticleLayer.shadowRadius = 6
    reticleLayer.shadowOpacity = 0.6
    reticleLayer.shadowOffset = .zero
    reticleLayer.opacity = 0
    layer.addSublayer(reticleLayer)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer.frame = bounds
    reticleLayer.frame = bounds
  }

  // MARK: - Props (called from the module DSL)

  func setActive(_ active: Bool) {
    if active {
      start()
    } else {
      stop()
    }
  }

  func setTorch(_ on: Bool) {
    sessionQueue.async { [weak self] in
      guard let self, let device = self.device, device.hasTorch else { return }
      do {
        try device.lockForConfiguration()
        device.torchMode = on ? .on : .off
        device.unlockForConfiguration()
      } catch {
        // Torch is a nicety — never surface as a mount error.
      }
    }
  }

  func setDetectionEnabled(_ enabled: Bool) {
    detectionEnabled = enabled
    if !enabled {
      steadyStreak = 0
      lastCentroid = nil
      DispatchQueue.main.async { [weak self] in self?.hideReticle() }
    }
  }

  func setAutoCapture(_ on: Bool) {
    autoCapture = on
    steadyStreak = 0
  }

  // Pinch-driven zoom, clamped to a sane card-scanning range.
  func setZoom(_ zoom: Double) {
    let z = CGFloat(max(1.0, min(zoom, 5.0)))
    pendingZoom = z
    sessionQueue.async { [weak self] in
      guard let self, let device = self.device else { return }
      do {
        try device.lockForConfiguration()
        let maxZoom = min(device.activeFormat.videoMaxZoomFactor, 5.0)
        device.videoZoomFactor = max(1.0, min(z, maxZoom))
        device.unlockForConfiguration()
      } catch {}
    }
  }

  // Prop-driven capture trigger: JS sets a fresh request id (a uuid) to
  // fire a capture. The result comes back on `onCapture` carrying the same
  // id so the caller can match it. This is more robust across Expo
  // versions than an imperative view function + ref plumbing.
  func setCaptureRequest(_ id: String) {
    guard !id.isEmpty, id != lastCaptureRequestId else { return }
    lastCaptureRequestId = id
    capture(requestId: id)
  }

  // MARK: - Session lifecycle

  private func start() {
    sessionQueue.async { [weak self] in
      guard let self else { return }
      if !self.configured {
        self.configure()
      }
      guard self.configured, !self.session.isRunning else { return }
      self.session.startRunning()
      self.running = true
      DispatchQueue.main.async { self.onCameraReady(["ready": true]) }
    }
  }

  private func stop() {
    sessionQueue.async { [weak self] in
      guard let self, self.session.isRunning else { return }
      self.session.stopRunning()
      self.running = false
    }
  }

  private func configure() {
    session.beginConfiguration()
    session.sessionPreset = .photo

    guard
      let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
      let input = try? AVCaptureDeviceInput(device: device),
      session.canAddInput(input)
    else {
      session.commitConfiguration()
      DispatchQueue.main.async { [weak self] in
        self?.onMountError(["message": "Camera unavailable"])
      }
      return
    }
    self.device = device
    session.addInput(input)

    if session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
      photoOutput.isHighResolutionCaptureEnabled = true
    }

    videoOutput.setSampleBufferDelegate(self, queue: videoQueue)
    videoOutput.alwaysDiscardsLateVideoFrames = true
    videoOutput.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ]
    if session.canAddOutput(videoOutput) {
      session.addOutput(videoOutput)
      if let conn = videoOutput.connection(with: .video), conn.isVideoOrientationSupported {
        conn.videoOrientation = .portrait
      }
    }

    session.commitConfiguration()
    configured = true
  }

  // MARK: - Live detection (video frames → Vision → reticle)

  func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    guard detectionEnabled else { return }
    // Throttle to ~8fps — detection every frame is wasteful and the
    // reticle animates smoothly between updates anyway.
    let now = CACurrentMediaTime()
    guard now - lastDetectAt > 0.12 else { return }
    lastDetectAt = now

    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

    let request = VNDetectRectanglesRequest()
    request.minimumAspectRatio = 0.55
    request.maximumAspectRatio = 0.95
    request.minimumSize = 0.15
    request.maximumObservations = 1
    request.minimumConfidence = 0.55
    request.quadratureTolerance = 25

    let handler = VNImageRequestHandler(
      cvPixelBuffer: pixelBuffer,
      orientation: .right,  // portrait video buffer
      options: [:]
    )
    guard (try? handler.perform([request])) != nil,
          let rect = (request.results ?? []).first
    else {
      lastNormalizedCorners = nil
      steadyStreak = 0
      lastCentroid = nil
      DispatchQueue.main.async { [weak self] in
        self?.hideReticle()
        self?.onCardDetected(["detected": false, "confidence": 0, "steady": false, "fill": 0])
      }
      return
    }

    // Vision gives normalized [0,1] corners, bottom-left origin.
    lastNormalizedCorners = [rect.topLeft, rect.topRight, rect.bottomRight, rect.bottomLeft]
    let confidence = Double(rect.confidence)

    // Fill ratio (card area / frame) → drives "move closer" hints.
    let widthN = hypot(rect.topRight.x - rect.topLeft.x, rect.topRight.y - rect.topLeft.y)
    let heightN = hypot(rect.bottomLeft.x - rect.topLeft.x, rect.bottomLeft.y - rect.topLeft.y)
    let fill = Double(widthN * heightN)

    // Steadiness: how little the centroid moved since the last frame.
    let cx = (rect.topLeft.x + rect.topRight.x + rect.bottomRight.x + rect.bottomLeft.x) / 4
    let cy = (rect.topLeft.y + rect.topRight.y + rect.bottomRight.y + rect.bottomLeft.y) / 4
    let centroid = CGPoint(x: cx, y: cy)
    if let last = lastCentroid {
      let drift = hypot(centroid.x - last.x, centroid.y - last.y)
      if drift < 0.02 { steadyStreak += 1 } else { steadyStreak = 0 }
    }
    lastCentroid = centroid

    let wellFramed = confidence > 0.6 && fill > 0.20
    let steady = wellFramed && steadyStreak >= autoSteadyFrames

    // Auto-capture: fire once the card is confidently framed AND held
    // still, respecting a cooldown so we don't machine-gun captures.
    let now2 = CACurrentMediaTime()
    if autoCapture, steady, !capturing, now2 - lastAutoCaptureAt > autoCaptureCooldown {
      lastAutoCaptureAt = now2
      steadyStreak = 0
      let autoId = "auto-\(UUID().uuidString.prefix(8))"
      lastCaptureRequestId = autoId
      capture(requestId: autoId)
    }

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.drawReticle(rect, ready: steady || wellFramed)
      self.onCardDetected([
        "detected": true,
        "confidence": confidence,
        "steady": steady,
        "fill": fill,
      ])
    }
  }

  private func drawReticle(_ rect: VNRectangleObservation, ready: Bool) {
    // Map normalized Vision points → preview-layer view coordinates.
    func toView(_ p: CGPoint) -> CGPoint {
      // Vision origin bottom-left; preview layer uses the standard
      // captureDevicePointConverted for correct aspect-fill mapping.
      let converted = previewLayer.layerPointConverted(fromCaptureDevicePoint: CGPoint(x: p.y, y: 1 - p.x))
      return converted
    }
    let tl = toView(rect.topLeft)
    let tr = toView(rect.topRight)
    let br = toView(rect.bottomRight)
    let bl = toView(rect.bottomLeft)

    // Corner-bracket path — L-shapes at each corner rather than a full
    // outline. Reads as a "targeting" frame and stays crisp at any tilt.
    let path = UIBezierPath()
    func bracket(_ corner: CGPoint, _ a: CGPoint, _ b: CGPoint) {
      let la = 0.22
      path.move(to: lerp(corner, a, la))
      path.addLine(to: corner)
      path.addLine(to: lerp(corner, b, la))
    }
    bracket(tl, tr, bl)
    bracket(tr, tl, br)
    bracket(br, tr, bl)
    bracket(bl, tl, br)

    let color = ready
      ? UIColor(red: 0.086, green: 0.753, blue: 0.612, alpha: 0.98)
      : UIColor(white: 1.0, alpha: 0.85)

    CATransaction.begin()
    CATransaction.setAnimationDuration(0.1)
    reticleLayer.path = path.cgPath
    reticleLayer.fillColor = UIColor.clear.cgColor
    reticleLayer.strokeColor = color.cgColor
    reticleLayer.lineWidth = ready ? 4.0 : 3.0
    reticleLayer.shadowColor = color.cgColor
    reticleLayer.shadowOpacity = ready ? 0.8 : 0.3
    reticleLayer.opacity = 1
    CATransaction.commit()
  }

  private func lerp(_ a: CGPoint, _ b: CGPoint, _ t: CGFloat) -> CGPoint {
    return CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t)
  }

  private func hideReticle() {
    CATransaction.begin()
    CATransaction.setAnimationDuration(0.2)
    reticleLayer.opacity = 0
    CATransaction.commit()
  }

  // MARK: - Still capture

  private func capture(requestId: String) {
    guard configured, running else {
      onCapture(["requestId": requestId, "error": "Camera is not running"])
      return
    }
    guard !capturing else {
      onCapture(["requestId": requestId, "error": "Capture already in progress"])
      return
    }
    capturing = true
    activeCaptureRequestId = requestId
    sessionQueue.async { [weak self] in
      guard let self else { return }
      let settings = AVCapturePhotoSettings()
      settings.isHighResolutionPhotoEnabled = true
      if let device = self.device, device.hasFlash {
        settings.flashMode = .off
      }
      self.photoOutput.capturePhoto(with: settings, delegate: self)
    }
  }
}

// MARK: - Photo capture delegate

extension LoupeCameraView: AVCapturePhotoCaptureDelegate {
  func photoOutput(
    _ output: AVCapturePhotoOutput,
    didFinishProcessingPhoto photo: AVCapturePhoto,
    error: Error?
  ) {
    let requestId = activeCaptureRequestId
    capturing = false
    activeCaptureRequestId = ""

    if let error {
      onCapture(["requestId": requestId, "error": error.localizedDescription])
      return
    }
    guard let data = photo.fileDataRepresentation() else {
      onCapture(["requestId": requestId, "error": "No image data"])
      return
    }
    let outURL = URL(fileURLWithPath: NSTemporaryDirectory())
      .appendingPathComponent("scan-\(UUID().uuidString.prefix(8)).jpg")
    do {
      try data.write(to: outURL, options: .atomic)
    } catch {
      onCapture(["requestId": requestId, "error": error.localizedDescription])
      return
    }

    // Include the last-known card corners (normalized, top-left origin)
    // so JS can hand them straight to `cropCardPerspective` without a
    // second detection pass on the still.
    var cornerArray: [Double]? = nil
    if let c = lastNormalizedCorners {
      // c is [tl, tr, br, bl] in bottom-left normalized space → flip Y.
      cornerArray = c.flatMap { [Double($0.x), Double(1 - $0.y)] }
    }

    onCapture([
      "requestId": requestId,
      "uri": outURL.absoluteString,
      "corners": cornerArray as Any,
    ])
  }
}
