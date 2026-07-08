import SwiftUI
import UIKit
import ImageIO

// ─────────────────────────────────────────────────────────────────────
// Native SwiftUI scanner overlay.
//
// Everything the user sees over the camera — the top bar (close, game
// selector, AUTO, torch, status), the framing hint / error banner, the
// zoom presets, the rolling session tray, and the shutter — is drawn
// here in SwiftUI on native `.ultraThinMaterial` glass. It is a pure
// presentation layer: all state is pushed in from JS via `ScannerOverlayModel`
// and every interaction is forwarded back out through its closures (wired
// to Expo EventDispatchers by the host `LoupeCameraView`). The identify
// pipeline, pricing, navigation and Pro gating all stay in JS.
// ─────────────────────────────────────────────────────────────────────

// MARK: - Model (pushed from JS)

struct ScannerItem: Identifiable, Equatable {
  let id: String
  let imageUrl: String?
  let photoUri: String?
  let title: String
  let subtitle: String
  let status: String // "scanning" | "matched" | "missed"
}

final class ScannerOverlayModel: ObservableObject {
  @Published var statusText: String = "Frame a card · tap the shutter"
  @Published var hintText: String? = nil
  @Published var errorText: String? = nil
  @Published var tcgLabel: String = "Auto-detect"
  @Published var tcgKey: String = "auto"
  @Published var tcgAccentHex: String = "#16C09C"
  @Published var torchOn: Bool = false
  @Published var autoOn: Bool = false
  @Published var autoSupported: Bool = true
  @Published var zoom: Double = 1
  @Published var slotsLeft: Int = -1
  @Published var busy: Bool = false
  @Published var items: [ScannerItem] = []
  @Published var matchedCount: Int = 0
  @Published var totalText: String? = nil
  @Published var canAddAll: Bool = false
  // Device safe-area insets, pushed from the host UIView (the SwiftUI
  // overlay is a bare hosting subview so it does NOT inherit them) — without
  // this the top bar renders up under the Dynamic Island / notch and can't
  // be tapped.
  @Published var topInset: CGFloat = 0
  @Published var bottomInset: CGFloat = 0

  // Actions → EventDispatchers (assigned by the host view).
  var onClose: () -> Void = {}
  var onShutter: () -> Void = {}
  var onToggleTorch: () -> Void = {}
  var onToggleAuto: () -> Void = {}
  var onZoom: (Double) -> Void = { _ in }
  var onManualSearch: () -> Void = {}
  var onDismissError: () -> Void = {}
  var onPickTcg: (String) -> Void = { _ in }
  var onPickCard: (String) -> Void = { _ in }
  var onRemoveCard: (String) -> Void = { _ in }
  var onAddAll: () -> Void = {}
}

// MARK: - Color hex helper

extension Color {
  init(hexString: String, fallback: Color = .green) {
    var s = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let v = UInt64(s, radix: 16) else { self = fallback; return }
    self = Color(
      red: Double((v >> 16) & 0xFF) / 255.0,
      green: Double((v >> 8) & 0xFF) / 255.0,
      blue: Double(v & 0xFF) / 255.0
    )
  }
}

// MARK: - Root overlay

struct ScannerOverlayView: View {
  @ObservedObject var model: ScannerOverlayModel

  private let tcgOptions: [(key: String, label: String, hex: String)] = [
    ("auto", "Auto-detect", "#16C09C"),
    ("pokemon", "Pokémon", "#F0B429"),
    ("magic", "Magic", "#3B82F6"),
    ("yugioh", "Yu-Gi-Oh!", "#8B5CF6"),
  ]

  var body: some View {
    VStack(spacing: 0) {
      topBar
      Spacer(minLength: 0)
      zoomPresets
      bottomPanel
    }
    .padding(.horizontal, 12)
    // Clear the Dynamic Island / notch and the home indicator — the hosting
    // view fills the whole screen and doesn't inherit the safe area.
    .padding(.top, max(model.topInset, 8))
    .padding(.bottom, max(model.bottomInset, 8))
  }

  // MARK: Top bar

  private var topBar: some View {
    VStack(spacing: 10) {
      HStack {
        glassCircle(system: "xmark", action: model.onClose)

        Spacer()

        // Native dropdown menu anchored to the pill (not a bottom sheet) —
        // pick a game, checkmark shows the current one.
        Menu {
          ForEach(tcgOptions, id: \.key) { opt in
            Button {
              model.onPickTcg(opt.key)
            } label: {
              if opt.label == model.tcgLabel {
                Label(opt.label, systemImage: "checkmark")
              } else {
                Text(opt.label)
              }
            }
          }
        } label: {
          HStack(spacing: 8) {
            Circle()
              .fill(Color(hexString: model.tcgAccentHex))
              .frame(width: 8, height: 8)
            Text(model.tcgLabel)
              .font(.system(size: 15, weight: .heavy))
              .foregroundColor(.white)
            Image(systemName: "chevron.down")
              .font(.system(size: 12, weight: .bold))
              .foregroundColor(.white.opacity(0.7))
          }
          .padding(.leading, 14).padding(.trailing, 12).padding(.vertical, 10)
          .background(.ultraThinMaterial, in: Capsule())
          .overlay(Capsule().stroke(.white.opacity(0.16), lineWidth: 1))
        }

        Spacer()

        HStack(spacing: 8) {
          if model.autoSupported {
            Button(action: model.onToggleAuto) {
              HStack(spacing: 5) {
                Image(systemName: "wand.and.stars")
                  .font(.system(size: 14, weight: .bold))
                Text("AUTO").font(.system(size: 11, weight: .heavy))
              }
              .foregroundColor(model.autoOn ? Color(hexString: "#06140d") : .white)
              .padding(.horizontal, 12).frame(height: 44)
              .background(
                model.autoOn
                  ? AnyShapeStyle(Color(hexString: "#16C09C"))
                  : AnyShapeStyle(.ultraThinMaterial),
                in: Capsule()
              )
            }
          }
          glassCircle(
            system: model.torchOn ? "bolt.fill" : "bolt.slash.fill",
            tint: model.torchOn ? Color(hexString: "#F0B429") : .white,
            action: model.onToggleTorch
          )
        }
      }

      HStack(spacing: 6) {
        Circle().fill(Color(hexString: "#16C09C")).frame(width: 6, height: 6)
        Text(model.statusText)
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(.white.opacity(0.75))
      }
    }
    .padding(.top, 12)
  }

  // MARK: Zoom

  private var zoomPresets: some View {
    HStack(spacing: 10) {
      ForEach([1.0, 2.0, 3.0], id: \.self) { z in
        let on = Int(model.zoom.rounded()) == Int(z)
        Button {
          model.onZoom(z)
        } label: {
          Text("\(Int(z))×")
            .font(.system(size: on ? 13 : 11.5, weight: .heavy))
            .foregroundColor(on ? Color(hexString: "#06140d") : .white.opacity(0.9))
            .frame(minWidth: on ? 44 : 34, minHeight: 34)
            .padding(.horizontal, on ? 12 : 0)
            .background(
              on ? AnyShapeStyle(Color(hexString: "#16C09C")) : AnyShapeStyle(.ultraThinMaterial),
              in: Capsule()
            )
        }
      }
    }
    .padding(.bottom, 12)
  }

  // MARK: Bottom panel

  private var bottomPanel: some View {
    VStack(spacing: 8) {
      if let err = model.errorText {
        Button(action: model.onDismissError) {
          HStack(spacing: 10) {
            Circle().fill(Color(hexString: "#F87171")).frame(width: 7, height: 7)
            Text(err).font(.system(size: 12.5, weight: .semibold))
              .foregroundColor(.white.opacity(0.92)).lineLimit(2)
          }
          .padding(.horizontal, 16).padding(.vertical, 11)
          .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
      }

      if model.items.isEmpty {
        hintPill(model.busy ? "Identifying…" : (model.hintText ?? "Frame the card, then tap the shutter"))
      } else if let hint = model.hintText {
        hintPill(hint)
      }

      if !model.items.isEmpty {
        sessionTray
      }

      shutterRow
    }
    .padding(.bottom, 8)
  }

  private func hintPill(_ text: String) -> some View {
    HStack(spacing: 8) {
      if model.busy {
        ProgressView().scaleEffect(0.8).tint(Color(hexString: "#16C09C"))
      } else {
        Circle().fill(Color(hexString: "#16C09C")).frame(width: 6, height: 6)
      }
      Text(text).font(.system(size: 12, weight: .semibold)).foregroundColor(.white.opacity(0.88))
    }
    .padding(.horizontal, 16).padding(.vertical, 10)
    .background(.ultraThinMaterial, in: Capsule())
  }

  private var sessionTray: some View {
    VStack(spacing: 0) {
      HStack {
        HStack(spacing: 7) {
          Image(systemName: "camera.fill").font(.system(size: 13))
            .foregroundColor(Color(hexString: "#16C09C"))
          Text("This session").font(.system(size: 13, weight: .heavy)).foregroundColor(.white)
          Text("\(model.matchedCount)/\(model.items.count) matched")
            .font(.system(size: 11, weight: .bold)).foregroundColor(.white.opacity(0.5))
        }
        Spacer()
        HStack(spacing: 10) {
          if let total = model.totalText {
            HStack(spacing: 5) {
              Text("TOTAL").font(.system(size: 9, weight: .heavy)).foregroundColor(.white.opacity(0.48))
              Text(total).font(.system(size: 16, weight: .black)).foregroundColor(Color(hexString: "#16C09C"))
            }
          }
          if model.canAddAll {
            Button(action: model.onAddAll) {
              HStack(spacing: 5) {
                Image(systemName: "plus").font(.system(size: 12, weight: .heavy))
                Text("Add all").font(.system(size: 12, weight: .heavy))
              }
              .foregroundColor(Color(hexString: "#08110D"))
              .padding(.horizontal, 12).padding(.vertical, 7)
              .background(Color(hexString: "#16C09C"), in: Capsule())
            }
          }
        }
      }
      .padding(.horizontal, 12).padding(.top, 10)

      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 10) {
          ForEach(model.items) { item in
            trayCard(item)
          }
        }
        .padding(.horizontal, 10).padding(.vertical, 10)
      }
    }
    .background(Color(hexString: "#0B0E12").opacity(0.96), in: RoundedRectangle(cornerRadius: 20))
    .overlay(RoundedRectangle(cornerRadius: 20).stroke(.white.opacity(0.12), lineWidth: 1))
  }

  // Collectr-style tile: the captured photo is the skeleton and STAYS until
  // a match resolves, then smoothly crossfades into the card art while the
  // name / number / price morph in. A miss keeps the photo (tap to search);
  // nothing vanishes.
  private func trayCard(_ item: ScannerItem) -> some View {
    let matched = item.status == "matched"
    let missed = item.status == "missed"
    let accent = matched
      ? Color(hexString: "#16C09C")
      : (missed ? Color(hexString: "#F0B429") : Color(hexString: "#3B82F6"))
    return Button {
      if matched { model.onPickCard(item.id) } else if missed { model.onManualSearch() }
    } label: {
      HStack(spacing: 10) {
        trayImage(item)

        VStack(alignment: .leading, spacing: 3) {
          HStack(spacing: 6) {
            Circle().fill(accent).frame(width: 6, height: 6)
            Text(matched ? "SCANNED" : (missed ? "NO MATCH" : "READING…"))
              .font(.system(size: 9, weight: .black)).foregroundColor(.white.opacity(0.54))
          }
          Text(item.title).font(.system(size: 12.5, weight: .heavy))
            .foregroundColor(.white).lineLimit(2)          Text(item.subtitle).font(.system(size: 10.5, weight: .semibold))
            .foregroundColor(missed ? Color(hexString: "#16C09C") : .white.opacity(0.52))
            .lineLimit(1)        }
        Spacer(minLength: 0)
      }
      .padding(9)
      .frame(width: 190)
      .background(Color.white.opacity(matched ? 0.08 : 0.05), in: RoundedRectangle(cornerRadius: 16))
      .overlay(RoundedRectangle(cornerRadius: 16).stroke(accent.opacity(0.35), lineWidth: 1))
      .overlay(alignment: .topTrailing) {
        Button { model.onRemoveCard(item.id) } label: {
          Image(systemName: "xmark").font(.system(size: 10, weight: .bold))
            .foregroundColor(.white.opacity(0.88))
            .frame(width: 20, height: 20)
            .background(Color.black.opacity(0.48), in: Circle())
        }
        .padding(5)
      }
    }
    .buttonStyle(.plain)
    .animation(.spring(response: 0.42, dampingFraction: 0.82), value: item.status)
  }

  /// The tile's card image: the captured photo (skeleton) crossfading into
  /// the matched card art, with a shimmer while still reading.
  private func trayImage(_ item: ScannerItem) -> some View {
    let matched = item.status == "matched"
    let scanning = item.status == "scanning"
    return ZStack {
      Color.white.opacity(0.08)
      // Captured photo — visible until a match resolves.
      TrayThumbnail(imageUrl: nil, photoUri: item.photoUri)
        .opacity(matched ? 0 : 1)
      // Matched card art — crossfades in over the photo.
      TrayThumbnail(imageUrl: item.imageUrl, photoUri: nil)
        .opacity(matched ? 1 : 0)
      if scanning {
        ZStack {
          Color.black.opacity(0.28)
          ProgressView().tint(.white).scaleEffect(0.6)
        }
      }
    }
    .frame(width: 44, height: 44 * 3.5 / 2.5)
    .clipShape(RoundedRectangle(cornerRadius: 8))
    .animation(.easeInOut(duration: 0.4), value: matched)
  }

  private var shutterRow: some View {
    ZStack {
      Button(action: model.onShutter) {
        ZStack {
          Circle().stroke(.white.opacity(0.95), lineWidth: 3.5).frame(width: 68, height: 68)
          Circle().fill(.white).frame(width: 50, height: 50)
          if model.busy {
            ProgressView().tint(Color(hexString: "#06140d"))
          }
        }
      }
      HStack {
        Spacer()
        Button(action: model.onManualSearch) {
          Image(systemName: "magnifyingglass").font(.system(size: 22, weight: .semibold))
            .foregroundColor(.white)
            .frame(width: 52, height: 52)
            .background(.ultraThinMaterial, in: Circle())
        }
      }
    }
    .frame(height: 76)
  }

  private func glassCircle(system: String, tint: Color = .white, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: system)
        .font(.system(size: 20, weight: .bold))
        .foregroundColor(tint)
        .frame(width: 46, height: 46)
        .background(.ultraThinMaterial, in: Circle())
        .overlay(Circle().stroke(.white.opacity(0.16), lineWidth: 1))
    }
  }
}

// MARK: - Tray thumbnail
//
// The just-captured photo is a LOCAL file:// path and matched card art is a
// remote https URL. AsyncImage only loads remote URLs, so the freshly
// captured "scanning" tile would render blank — the exact "put the photo in
// the widget while it identifies" behavior. This loads local files once
// (downsampled, off the main thread) and defers to AsyncImage for remote art.
struct TrayThumbnail: View {
  let imageUrl: String?
  let photoUri: String?
  @State private var local: UIImage?

  private var isRemote: Bool { imageUrl?.hasPrefix("http") == true }

  var body: some View {
    Group {
      if isRemote, let s = imageUrl, let url = URL(string: s) {
        AsyncImage(url: url) { img in
          img.resizable().aspectRatio(contentMode: .fill)
        } placeholder: {
          Color.white.opacity(0.08)
        }
      } else if let img = local {
        Image(uiImage: img).resizable().aspectRatio(contentMode: .fill)
      } else {
        Color.white.opacity(0.08)
      }
    }
    .task(id: photoUri) {
      guard !isRemote, let uri = photoUri else {
        local = nil
        return
      }
      // CGImageSource thumbnailing is robust + thread-safe and takes the
      // file URL directly (no path-stripping, no off-main UIKit rendering,
      // which is what left the tile blank before).
      let fileURL = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
      guard let fileURL else { return }
      let image = await Task.detached(priority: .utility) {
        loadThumbnail(fileURL, maxPixel: 240)
      }.value
      await MainActor.run { local = image }
    }
  }
}

/// Decode a downsampled thumbnail from a local image file without loading the
/// full-resolution bitmap. Thread-safe, with a direct-decode fallback so a
/// captured frame always renders even if thumbnailing fails.
private func loadThumbnail(_ url: URL, maxPixel: CGFloat) -> UIImage? {
  if let src = CGImageSourceCreateWithURL(url as CFURL, nil) {
    let opts: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: maxPixel,
    ]
    if let cg = CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary) {
      return UIImage(cgImage: cg)
    }
  }
  // Fallbacks: raw file decode, then a Data load (handles odd path forms).
  if let img = UIImage(contentsOfFile: url.path) { return img }
  if let data = try? Data(contentsOf: url) { return UIImage(data: data) }
  return nil
}
