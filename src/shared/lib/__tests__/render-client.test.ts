// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

import { pollRenderProgress, renderComposedBatch } from "../render-client";

class MockRenderXhr {
  static mode: "progress" | "batch" = "progress";
  status = 200;
  responseText = "";
  response: unknown = null;
  responseType = "";
  headers: Record<string, string> = {};

  open() {}
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  getResponseHeader(name: string) {
    if (name.toLowerCase() === "content-type") {
      return MockRenderXhr.mode === "batch" ? "application/zip" : "application/json";
    }
    return null;
  }
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  send() {
    if (MockRenderXhr.mode === "progress") {
      this.responseText = JSON.stringify({
        active: true,
        current: 2,
        total: 5,
        percent: 40,
        current_name: "Video #2",
      });
    } else {
      this.response = new Blob(["zipdata"], { type: "application/zip" });
    }
    this.onload?.();
  }
}

describe("shared/lib/render-client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("polls render progress and downloads rendered batch", async () => {
    vi.stubGlobal("XMLHttpRequest", MockRenderXhr);
    MockRenderXhr.mode = "progress";

    const snap = await pollRenderProgress("fld_1");
    expect(snap).toEqual({
      active: true,
      current: 2,
      total: 5,
      percent: 40,
      current_name: "Video #2",
    });

    MockRenderXhr.mode = "batch";
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:zip"),
      revokeObjectURL: vi.fn(),
    });
    const res = await renderComposedBatch({
      sessionId: "fld_1",
      videos: [
        {
          id: "v1",
          name: "Video #1",
          slots: [
            {
              category: "open",
              localUrl: "/api/media/fld_1/a.mp4",
              videoBegin: 0,
              videoEnd: 4,
              speed: 1,
              flipH: false,
            },
          ],
        },
      ],
      voices: [],
    });

    expect(res.fileName).toBe("lachvid_rendered_fld_1.zip");
  });
});
