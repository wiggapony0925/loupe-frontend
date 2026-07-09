import ExpoModulesCore
import AVFoundation
import Vision
import UIKit
import SwiftUI

// ── Overlay state pushed from JS ────────────────────────────────────
// The whole scanner chrome is a native SwiftUI overlay (ScannerOverlayView)
// driven by this one prop. It arrives as a JSON STRING (not an Expo Record)
// and is decoded with Codable — a plain Record with a nested array of
// Records (`items`) silently failed to decode, which dropped the ENTIRE
// prop and left the overlay stuck on its defaults (no tiles, stale hints).
private struct OverlayItemDTO: Decodable {
  let id: String
  let imageUrl: String?
  let photoUri: String?
  let title: String
  let subtitle: String
  let status: String
}

private struct OverlayStateDTO: Decodable {
  let statusText: String
  let hintText: String?
  let errorText: String?
  let tcgLabel: String
  let tcgAccentHex: String
  let torchOn: Bool
  let autoOn: Bool
  let autoSupported: Bool
  let zoom: Double
  let slotsLeft: Int
  let busy: Bool
  let matchedCount: Int
  let totalText: String?
  let canAddAll: Bool
  let items: [OverlayItemDTO]
}

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
  // SwiftUI overlay interactions → JS.
  let onOverlayClose = EventDispatcher()
  let onShutter = EventDispatcher()
  let onToggleTorch = EventDispatcher()
  let onToggleAuto = EventDispatcher()
  let onZoomChange = EventDispatcher()
  let onManualSearch = EventDispatcher()
  let onDismissError = EventDispatcher()
  let onPickTcg = EventDispatcher()
  let onPickCard = EventDispatcher()
  let onRemoveCard = EventDispatcher()
  let onAddAll = EventDispatcher()

  // ── Native SwiftUI overlay ──────────────────────────────────────
  private let overlayModel = ScannerOverlayModel()
  private var overlayHost: UIHostingController<ScannerOverlayView>?

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

  // ── Fixed card guide ────────────────────────────────────────────
  // The reticle is a STATIC card-shaped frame (a guide the user aligns the
  // card into), not a box that snaps onto whatever Vision finds. On capture
  // we crop the photo to EXACTLY this region — "what's in the green box is
  // what gets taken".
  //
  // The crop is computed purely from screen geometry: `guideFrac` is the guide
  // rect as a fraction of the preview bounds, and `viewAspect` is the preview's
  // width/height. `cropToGuide` replays the `.resizeAspectFill` mapping onto the
  // captured still to recover the same region — orientation-robust and, crucially,
  // valid from the first layout (it does NOT depend on a live preview connection
  // the way `metadataOutputRectConverted` did, which used to leave the crop stuck
  // on a wide default that captured well outside the box).
  private var reticleRect: CGRect = .zero
  private var guideFrac = CGRect(x: 0.07, y: 0.20, width: 0.86, height: 0.60)
  private var viewAspect: CGFloat = 0.462

  // ── Auto-capture / steadiness ───────────────────────────────────
  // A pro scanner captures itself when the card is well-framed and held
  // still. We track how many consecutive frames the card's centroid has
  // barely moved; once it's steady + confident + filling enough of the
  // frame for `autoSteadyFrames`, we auto-fire a capture.
  private var autoCapture = false
  private var steadyStreak = 0
  private var lastCentroid: CGPoint?
  private var lastAutoCaptureAt: TimeInterval = 0
  // Auto-capture only on a genuinely good, well-held frame — a lower bar
  // machine-guns blurry/partial frames that just come back "no match".
  private let autoSteadyFrames = 8
  private let autoCaptureCooldown: TimeInterval = 3.0
  private var pendingZoom: CGFloat = 1.0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .black
    setupPreview()
    setupReticle()
    setupOverlay()
    setupFocusTap()
  }

  // Tap-to-focus. `cancelsTouchesInView = false` so the SwiftUI overlay
  // controls still receive their taps; a tap also nudges focus + exposure to
  // that point (continuous, so it keeps tracking).
  private func setupFocusTap() {
    let tap = UITapGestureRecognizer(target: self, action: #selector(handleFocusTap(_:)))
    tap.cancelsTouchesInView = false
    addGestureRecognizer(tap)
  }

  @objc private func handleFocusTap(_ gesture: UITapGestureRecognizer) {
    guard configured, previewLayer != nil else { return }
    let point = gesture.location(in: self)
    let devicePoint = previewLayer.captureDevicePointConverted(fromLayerPoint: point)
    sessionQueue.async { [weak self] in
      guard let self, let device = self.device else { return }
      do {
        try device.lockForConfiguration()
        if device.isFocusPointOfInterestSupported,
           device.isFocusModeSupported(.continuousAutoFocus) {
          device.focusPointOfInterest = devicePoint
          device.focusMode = .continuousAutoFocus
        }
        if device.isExposurePointOfInterestSupported,
           device.isExposureModeSupported(.continuousAutoExposure) {
          device.exposurePointOfInterest = devicePoint
          device.exposureMode = .continuousAutoExposure
        }
        device.unlockForConfiguration()
      } catch {}
    }
  }

  // MARK: - SwiftUI overlay

  private func setupOverlay() {
    // Wire the SwiftUI overlay's interactions to the JS event dispatchers.
    overlayModel.onClose = { [weak self] in self?.onOverlayClose([:]) }
    overlayModel.onShutter = { [weak self] in self?.onShutter([:]) }
    overlayModel.onToggleTorch = { [weak self] in self?.onToggleTorch([:]) }
    overlayModel.onToggleAuto = { [weak self] in self?.onToggleAuto([:]) }
    overlayModel.onZoom = { [weak self] z in self?.onZoomChange(["zoom": z]) }
    overlayModel.onManualSearch = { [weak self] in self?.onManualSearch([:]) }
    overlayModel.onDismissError = { [weak self] in self?.onDismissError([:]) }
    overlayModel.onPickTcg = { [weak self] tcg in self?.onPickTcg(["tcg": tcg]) }
    overlayModel.onPickCard = { [weak self] id in self?.onPickCard(["id": id]) }
    overlayModel.onRemoveCard = { [weak self] id in self?.onRemoveCard(["id": id]) }
    overlayModel.onAddAll = { [weak self] in self?.onAddAll([:]) }

    let host = UIHostingController(rootView: ScannerOverlayView(model: overlayModel))
    host.view.backgroundColor = .clear
    host.view.frame = bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(host.view)
    overlayHost = host
  }

  // Push the full display state in from JS as a JSON string (decoded with
  // Codable, then applied on the main thread to drive SwiftUI).
  func setOverlayStateJson(_ json: String) {
    guard
      let data = json.data(using: .utf8),
      let state = try? JSONDecoder().decode(OverlayStateDTO.self, from: data)
    else { return }
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      let m = self.overlayModel
      m.statusText = state.statusText
      m.hintText = state.hintText
      m.errorText = state.errorText
      m.tcgLabel = state.tcgLabel
      m.tcgAccentHex = state.tcgAccentHex
      m.torchOn = state.torchOn
      m.autoOn = state.autoOn
      m.autoSupported = state.autoSupported
      m.zoom = state.zoom
      m.slotsLeft = state.slotsLeft
      m.busy = state.busy
      m.matchedCount = state.matchedCount
      m.totalText = state.totalText
      m.canAddAll = state.canAddAll
      m.items = state.items.map {
        ScannerItem(
          id: $0.id,
          imageUrl: $0.imageUrl,
          photoUri: $0.photoUri,
          title: $0.title,
          subtitle: $0.subtitle,
          status: $0.status
        )
      }
    }
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
    overlayHost?.view.frame = bounds
    // The bare hosting subview doesn't inherit the safe area, so feed the
    // device insets into the SwiftUI model (top bar must clear the island).
    if overlayModel.topInset != safeAreaInsets.top {
      overlayModel.topInset = safeAreaInsets.top
    }
    if overlayModel.bottomInset != safeAreaInsets.bottom {
      overlayModel.bottomInset = safeAreaInsets.bottom
    }
    updateReticleFrame()
  }

  // Centered, trading-card-aspect (2.5:3.5) guide frame + its region in the
  // captured photo (aspect-fill-correct via the preview layer).
  private func updateReticleFrame() {
    guard bounds.width > 0, bounds.height > 0 else { return }
    let cardAspect: CGFloat = 2.5 / 3.5
    let maxW = bounds.width * 0.86
    let maxH = bounds.height * 0.60
    var rw = maxW
    var rh = rw / cardAspect
    if rh > maxH {
      rh = maxH
      rw = rh * cardAspect
    }
    reticleRect = CGRect(
      x: (bounds.width - rw) / 2,
      y: (bounds.height - rh) / 2,
      width: rw,
      height: rh
    )
    // Record the guide as a fraction of the preview + the preview aspect, so
    // the crop can be reconstructed from screen geometry alone (no dependency
    // on a live preview connection). `cropToGuide` replays the aspect-fill.
    guideFrac = CGRect(
      x: reticleRect.minX / bounds.width,
      y: reticleRect.minY / bounds.height,
      width: reticleRect.width / bounds.width,
      height: reticleRect.height / bounds.height
    )
    viewAspect = bounds.width / bounds.height
    drawFixedReticle(ready: false)
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
      // Keep the fixed guide visible even while detection is paused.
      DispatchQueue.main.async { [weak self] in self?.drawFixedReticle(ready: false) }
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

    // Cards are held CLOSE, so bias autofocus to the near range and keep it
    // continuously refocusing + auto-exposing — the frame stays sharp as the
    // user moves the card instead of hunting or locking soft.
    do {
      try device.lockForConfiguration()
      if device.isFocusModeSupported(.continuousAutoFocus) {
        device.focusMode = .continuousAutoFocus
      }
      if device.isSmoothAutoFocusSupported {
        device.isSmoothAutoFocusEnabled = true
      }
      if device.isAutoFocusRangeRestrictionSupported {
        device.autoFocusRangeRestriction = .near
      }
      if device.isExposureModeSupported(.continuousAutoExposure) {
        device.exposureMode = .continuousAutoExposure
      }
      device.unlockForConfiguration()
    } catch {
      // Focus tuning is best-effort — never fail the mount over it.
    }

    if session.canAddOutput(photoOutput) {
      session.addOutput(photoOutput)
      photoOutput.isHighResolutionCaptureEnabled = true
      // Use the best the sensor offers — full resolution + quality-first.
      photoOutput.maxPhotoQualityPrioritization = .quality
      if #available(iOS 16.0, *) {
        if let maxDim = device.activeFormat.supportedMaxPhotoDimensions
          .max(by: { Int($0.width) * Int($0.height) < Int($1.width) * Int($1.height) }) {
          photoOutput.maxPhotoDimensions = maxDim
        }
      }
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
        self?.drawFixedReticle(ready: false)
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

    let wellFramed = confidence > 0.72 && fill > 0.26
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
      self.drawFixedReticle(ready: steady || wellFramed)
      self.onCardDetected([
        "detected": true,
        "confidence": confidence,
        "steady": steady,
        "fill": fill,
      ])
    }
  }

  // Static rounded-rectangle guide at the fixed `reticleRect` (Collectr
  // style). It does not move to chase the card — the user aligns the card
  // into it — it only recolors (dim → bright mint) when a card is
  // well-framed and steady.
  private func drawFixedReticle(ready: Bool) {
    let r = reticleRect
    guard r.width > 1, r.height > 1 else { return }
    let path = UIBezierPath(roundedRect: r, cornerRadius: 20)

    let color = ready
      ? UIColor(red: 0.086, green: 0.753, blue: 0.612, alpha: 1.0)
      : UIColor(red: 0.086, green: 0.753, blue: 0.612, alpha: 0.72)

    CATransaction.begin()
    CATransaction.setAnimationDuration(0.12)
    reticleLayer.path = path.cgPath
    reticleLayer.fillColor = UIColor.clear.cgColor
    reticleLayer.strokeColor = color.cgColor
    reticleLayer.lineWidth = ready ? 4.0 : 3.0
    reticleLayer.lineCap = .round
    reticleLayer.shadowColor = color.cgColor
    reticleLayer.shadowOpacity = ready ? 0.7 : 0.25
    reticleLayer.opacity = 1
    CATransaction.commit()
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
    // Refresh the guide geometry from the current bounds right before capture
    // (cheap; guards against a rotation/resize since the last layout).
    updateReticleFrame()
    sessionQueue.async { [weak self] in
      guard let self else { return }
      let settings = AVCapturePhotoSettings()
      settings.isHighResolutionPhotoEnabled = true
      settings.photoQualityPrioritization = .quality
      if #available(iOS 16.0, *) {
        settings.maxPhotoDimensions = self.photoOutput.maxPhotoDimensions
      }
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

    // Crop the high-res still to exactly the fixed guide frame — "what's in
    // the 4 corners is what gets taken". Falls back to the full frame if the
    // crop can't be produced, so capture can never come back empty. We send
    // NO corners so JS uploads this crop as-is (no second crop pass).
    let payload: Data
    if let cropped = cropToGuide(data), let jpeg = cropped.jpegData(compressionQuality: 0.92) {
      payload = jpeg
    } else {
      payload = data
    }
    do {
      try payload.write(to: outURL, options: .atomic)
    } catch {
      onCapture(["requestId": requestId, "error": error.localizedDescription])
      return
    }

    onCapture([
      "requestId": requestId,
      "uri": outURL.absoluteString,
      "corners": [Double](),
    ])
  }

  // Crop the captured photo to EXACTLY the green guide box, then downscale to a
  // sharp ~1200px upload. The preview shows the sensor `.resizeAspectFill`
  // (scaled to cover the screen, overflow cropped), so only the middle slice of
  // the still is visible on screen. We reconstruct that visible window from the
  // photo/preview aspect ratios, then take the guide's fractional rect within
  // it — orientation-robust and independent of any AVFoundation coordinate
  // conversion.
  private func cropToGuide(_ data: Data) -> UIImage? {
    guard let raw = UIImage(data: data) else { return nil }
    let up = raw.normalizedUp()
    guard let cg = up.cgImage else { return nil }
    let W = CGFloat(cg.width), H = CGFloat(cg.height)
    guard W > 0, H > 0, viewAspect > 0 else { return nil }

    // Fraction of the still that is actually visible on screen under aspect-fill.
    let photoAspect = W / H
    var visW: CGFloat = 1, visH: CGFloat = 1
    if photoAspect > viewAspect {
      // Still is wider than the screen → full height shown, sides cropped.
      visW = viewAspect / photoAspect
    } else {
      // Still is taller/narrower than the screen → full width shown, top/bottom cropped.
      visH = photoAspect / viewAspect
    }
    let visX = (1 - visW) / 2, visY = (1 - visH) / 2

    // Place the guide (fractional within the visible window) into still coords.
    let g = guideFrac
    let fx = min(max(0, visX + g.minX * visW), 1)
    let fy = min(max(0, visY + g.minY * visH), 1)
    let fw = min(g.width * visW, 1 - fx)
    let fh = min(g.height * visH, 1 - fy)
    let cropRect = CGRect(x: fx * W, y: fy * H, width: fw * W, height: fh * H).integral

    // Pick the source: the guide crop normally, but if it's degenerate OR comes
    // out near-uniform, fall back to the FULL frame. A near-uniform crop means
    // the ROI landed on a blank / off-card region — the exact bug that made
    // every scan upload a flat white ~885-byte JPEG (phash 8000…, empty OCR, no
    // match). Better to send the whole in-focus card than a blank box.
    var source: CGImage = cg
    if cropRect.width > 40, cropRect.height > 40,
       let out = cg.cropping(to: cropRect), !Self.isNearUniform(out) {
      source = out
    }

    let cropped = UIImage(cgImage: source)
    let maxEdge: CGFloat = 1200
    let longest = max(cropped.size.width, cropped.size.height)
    guard longest > maxEdge else { return cropped }
    let scale = maxEdge / longest
    let target = CGSize(width: cropped.size.width * scale, height: cropped.size.height * scale)
    let fmt = UIGraphicsImageRendererFormat.default()
    fmt.scale = 1
    return UIGraphicsImageRenderer(size: target, format: fmt).image { _ in
      cropped.draw(in: CGRect(origin: .zero, size: target))
    }
  }

  // True when an image is (near) a single flat colour — no card in it. Drawn
  // down to 8x8 and checked for luma spread; a real card has strong contrast,
  // a blank/blown-out region collapses to one value. Guards the crop from ever
  // uploading a flat frame again. On any drawing failure returns false (don't
  // reject — fail open).
  private static func isNearUniform(_ cg: CGImage) -> Bool {
    let n = 8
    var buf = [UInt8](repeating: 0, count: n * n * 4)
    guard let cs = CGColorSpace(name: CGColorSpace.sRGB),
          let ctx = CGContext(
            data: &buf, width: n, height: n, bitsPerComponent: 8,
            bytesPerRow: n * 4, space: cs,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          )
    else { return false }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: n, height: n))
    var lo = 255, hi = 0
    for i in 0 ..< (n * n) {
      let luma = (Int(buf[i * 4]) * 299 + Int(buf[i * 4 + 1]) * 587 + Int(buf[i * 4 + 2]) * 114) / 1000
      lo = min(lo, luma)
      hi = max(hi, luma)
    }
    return (hi - lo) < 12
  }
}

private extension UIImage {
  /// Redraw into `.up` orientation so pixel crops line up with display coords.
  func normalizedUp() -> UIImage {
    guard imageOrientation != .up else { return self }
    let fmt = UIGraphicsImageRendererFormat.default()
    fmt.scale = scale
    return UIGraphicsImageRenderer(size: size, format: fmt).image { _ in
      draw(in: CGRect(origin: .zero, size: size))
    }
  }
}
