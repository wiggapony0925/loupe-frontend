/**
 * Wire contract tests for the scan ingest flow (`/v1/scans/*`, `/ws/scans`).
 *
 * Static — no network. These lock the field names the frontend sends and
 * expects against the shapes the backend documents in `app/schemas/scan.py`.
 * If a backend dev renames a field (e.g. `upload_url` → `url`, or the
 * terminal `result.graded_card_id`) the wire type stops compiling here and
 * the build fails loudly.
 *
 * Whenever you change `app/schemas/scan.py` or `app/tasks/scan_processor.py`
 * on the backend, mirror the change in the fixtures below.
 */

import type {
  PresignedUpload,
  ScanJob,
  ScanJobCompleteRequest,
  ScanJobCreate,
  ScanJobCreateResponse,
  ScanProgressEvent,
} from "@/infrastructure/http";

describe("scan ingest wire contract", () => {
  it("ScanJobCreate matches the POST /v1/scans request body", () => {
    const body: ScanJobCreate = {
      scanner_id: null,
      source: "phone",
      angles: ["front", "back", "top", "bottom"],
    };
    expect(Object.keys(body).sort()).toEqual(
      ["angles", "scanner_id", "source"].sort(),
    );
  });

  it("PresignedUpload exposes the fields the client PUTs against", () => {
    const upload: PresignedUpload = {
      angle: "front",
      upload_url: "https://storage.example/loupe/scan/front.jpg?sig=…",
      s3_key: "scans/u1/j1/front.jpg",
      expires_in: 900,
    };
    expect(Object.keys(upload).sort()).toEqual(
      ["angle", "expires_in", "s3_key", "upload_url"].sort(),
    );
  });

  it("ScanJobCreateResponse pairs the job with its presigned uploads", () => {
    const job: ScanJob = {
      id: "j1",
      user_id: "u1",
      scanner_id: null,
      status: "queued",
      source: "phone",
      images_s3_keys: null,
      error_message: null,
      created_at: "2026-01-01T00:00:00Z",
      started_at: null,
      completed_at: null,
    };
    const res: ScanJobCreateResponse = {
      job,
      uploads: [
        {
          angle: "front",
          upload_url: "https://storage.example/front",
          s3_key: "scans/u1/j1/front.jpg",
          expires_in: 900,
        },
      ],
    };
    expect(Object.keys(res).sort()).toEqual(["job", "uploads"].sort());
    expect(Object.keys(res.job).sort()).toEqual(
      [
        "completed_at",
        "created_at",
        "error_message",
        "id",
        "images_s3_keys",
        "scanner_id",
        "source",
        "started_at",
        "status",
        "user_id",
      ].sort(),
    );
  });

  it("ScanJobCompleteRequest carries the uploaded angles", () => {
    const body: ScanJobCompleteRequest = {
      uploaded_angles: ["front", "back"],
    };
    expect(Object.keys(body)).toEqual(["uploaded_angles"]);
  });

  it("ScanProgressEvent carries the graded-card id on completion", () => {
    const event: ScanProgressEvent = {
      type: "scan_progress",
      job_id: "j1",
      status: "complete",
      progress: 1,
      message: null,
      result: {
        graded_card_id: "gc1",
        grade: 9.5,
        subgrades: { centering: 9, corners: 10, edges: 9.5, surface: 9.5 },
        fingerprint: "a1b2c3",
      },
    };
    expect(event.result?.graded_card_id).toBe("gc1");
    expect(Object.keys(event).sort()).toEqual(
      ["job_id", "message", "progress", "result", "status", "type"].sort(),
    );
  });
});
