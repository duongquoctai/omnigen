// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { readVideoMetadata, uploadFileInChunks } from "../chunked-upload";

class MockXhr {
  static nextStatuses: number[] = [200];
  static nextBodies: string[] = [JSON.stringify({ ok: true, url: "/api/media/s1/source/a.mp4" })];

  status = 200;
  responseText = "";
  headers: Record<string, string> = {};
  upload: { onprogress: ((ev: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  open() {}
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send() {
    const status = MockXhr.nextStatuses.shift() ?? 200;
    const body = MockXhr.nextBodies.shift() ?? "{}";
    this.status = status;
    this.responseText = body;
    if (this.upload.onprogress) {
      this.upload.onprogress({ lengthComputable: true, loaded: 10 } as ProgressEvent);
    }
    if (status === 0) {
      this.onerror?.();
    } else {
      this.onload?.();
    }
  }
}

describe("shared/lib/chunked-upload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockXhr.nextStatuses = [200];
    MockXhr.nextBodies = [JSON.stringify({ ok: true, url: "/api/media/s1/source/a.mp4" })];
  });

  it("uploads a file in chunks with progress and retries on transient error", async () => {
    vi.stubGlobal("XMLHttpRequest", MockXhr);
    MockXhr.nextStatuses = [500, 200];
    MockXhr.nextBodies = [
      JSON.stringify({ error: "temporary" }),
      JSON.stringify({ ok: true, url: "/api/media/s1/source/a.mp4", duration: 12 }),
    ];

    const onProgress = vi.fn();
    const file = new File(["hello"], "demo.mp4", { type: "video/mp4" });
    const res = await uploadFileInChunks(file, {
      sessionId: "sess_1",
      projectId: "fld_1",
      kind: "source",
      duration: 12,
      width: 1080,
      height: 1920,
      onProgress,
    });

    expect(res.url).toBe("/api/media/s1/source/a.mp4");
    expect(onProgress).toHaveBeenCalled();
  });

  it("falls back cleanly when document is unavailable", async () => {
    vi.stubGlobal("document", undefined);
    const file = new File(["hello"], "demo.mp4", { type: "video/mp4" });
    const meta = await readVideoMetadata(file);
    expect(meta).toEqual({ duration: 38, width: 1080, height: 1920 });
  });
});
