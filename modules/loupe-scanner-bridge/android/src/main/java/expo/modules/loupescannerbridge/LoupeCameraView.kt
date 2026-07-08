package expo.modules.loupescannerbridge

import android.content.Context
import android.net.Uri
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import expo.modules.kotlin.viewevent.EventDispatcher
import java.io.File
import java.util.UUID

// Native Android camera for the card scanner — the CameraX counterpart of
// the iOS Swift `LoupeCameraView`. Same JS contract (props + events) so the
// shared `LoupeCameraView` React component and the `/scan/native` screen
// drive both platforms through one interface.
//
// Parity note: live Vision-style rectangle detection + the auto-capture
// reticle are iOS-only for now (Android would need ML Kit object detection
// or OpenCV). Android ships the native preview + torch + zoom + still
// capture; `onCardDetected` is not emitted, so the JS auto-capture path
// simply stays idle and the user taps the shutter. The identify pipeline
// is identical from the captured URI onward.
class LoupeCameraView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), LifecycleOwner {

  // ── Events → JS (names match the Swift EventDispatchers) ──
  private val onCameraReady by EventDispatcher()
  private val onCardDetected by EventDispatcher()
  private val onCapture by EventDispatcher()
  private val onMountError by EventDispatcher()

  private val previewView = PreviewView(context)
  private val lifecycleRegistry = LifecycleRegistry(this)
  private var cameraProvider: ProcessCameraProvider? = null
  private var imageCapture: ImageCapture? = null
  private var camera: androidx.camera.core.Camera? = null
  private var started = false
  private var pendingTorch = false
  private var pendingZoom = 1.0f
  private var lastCaptureRequestId = ""

  init {
    addView(previewView)
    lifecycleRegistry.currentState = Lifecycle.State.CREATED
  }

  // The androidx.lifecycle on the classpath exposes LifecycleOwner as the Java
  // `getLifecycle()` method — implement that form so it compiles across
  // lifecycle versions (a `val lifecycle` override "overrides nothing" here).
  override fun getLifecycle(): Lifecycle = lifecycleRegistry

  // ── Props ──

  fun setActive(active: Boolean) {
    if (active) start() else stop()
  }

  fun setTorch(on: Boolean) {
    pendingTorch = on
    camera?.cameraControl?.enableTorch(on)
  }

  fun setDetectionEnabled(@Suppress("UNUSED_PARAMETER") enabled: Boolean) {
    // No live detection on Android yet — no-op so the shared JS contract
    // is satisfied without behavioural difference.
  }

  fun setAutoCapture(@Suppress("UNUSED_PARAMETER") on: Boolean) {
    // No steady-detection signal on Android → auto-capture never fires;
    // users tap the shutter. No-op keeps the contract uniform.
  }

  fun setZoom(zoom: Double) {
    val z = zoom.toFloat().coerceIn(1.0f, 5.0f)
    pendingZoom = z
    camera?.cameraControl?.setZoomRatio(z)
  }

  fun setCaptureRequest(id: String) {
    if (id.isEmpty() || id == lastCaptureRequestId) return
    lastCaptureRequestId = id
    capture(id)
  }

  // ── Lifecycle ──

  private fun start() {
    if (started) return
    started = true
    lifecycleRegistry.currentState = Lifecycle.State.STARTED
    lifecycleRegistry.currentState = Lifecycle.State.RESUMED
    val providerFuture = ProcessCameraProvider.getInstance(context)
    providerFuture.addListener({
      try {
        val provider = providerFuture.get()
        cameraProvider = provider
        val preview = Preview.Builder().build().also {
          it.setSurfaceProvider(previewView.surfaceProvider)
        }
        val capture = ImageCapture.Builder()
          .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
          .build()
        imageCapture = capture
        provider.unbindAll()
        camera = provider.bindToLifecycle(
          this,
          CameraSelector.DEFAULT_BACK_CAMERA,
          preview,
          capture,
        )
        camera?.cameraControl?.enableTorch(pendingTorch)
        camera?.cameraControl?.setZoomRatio(pendingZoom)
        onCameraReady(mapOf("ready" to true))
      } catch (e: Exception) {
        onMountError(mapOf("message" to (e.message ?: "Camera unavailable")))
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun stop() {
    if (!started) return
    started = false
    try {
      cameraProvider?.unbindAll()
    } catch (_: Exception) {}
    lifecycleRegistry.currentState = Lifecycle.State.CREATED
  }

  // ── Capture ──

  private fun capture(requestId: String) {
    val capture = imageCapture
    if (capture == null) {
      onCapture(mapOf("requestId" to requestId, "error" to "Camera is not running"))
      return
    }
    val outFile = File(context.cacheDir, "scan-${UUID.randomUUID().toString().take(8)}.jpg")
    val options = ImageCapture.OutputFileOptions.Builder(outFile).build()
    capture.takePicture(
      options,
      ContextCompat.getMainExecutor(context),
      object : ImageCapture.OnImageSavedCallback {
        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
          val uri = output.savedUri ?: Uri.fromFile(outFile)
          // Android emits no corners (no live detection) — omit the key rather
          // than pass a null value, which would make the map Map<String, String?>
          // and fail the EventDispatcher's Map<String, Any> signature.
          onCapture(mapOf("requestId" to requestId, "uri" to uri.toString()))
        }

        override fun onError(exc: ImageCaptureException) {
          onCapture(mapOf("requestId" to requestId, "error" to (exc.message ?: "Capture failed")))
        }
      },
    )
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    previewView.layout(0, 0, r - l, b - t)
  }
}
