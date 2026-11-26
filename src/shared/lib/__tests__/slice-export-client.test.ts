// @vitest-environment happy-dom

import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resetSourceSession,
  sliceAndDownloadZip,
  sliceAndSaveToDirectory,
} from "../slice-export-client";

describe("shared/lib/slice-export-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when shots are empty", async () => {
    await expect(
      sliceAndDownloadZip({
        sessionId: "s1",
        categoryMinDurations: { open: 5.8 },
        shots: [],
      }),
    ).rejects.toThrow("Chưa có cảnh nào");
  });

  it("downloads zip when shots exist", async () => {
    const zip = new JSZip();
    zip.file("OPEN/shot1.mp4", new Uint8Array([1, 2, 3]));
    const blob = await zip.generateAsync({ type: "blob" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(blob),
      }),
    );
    const createUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:zip");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await sliceAndDownloadZip({
      sessionId: "s1",
      categoryMinDurations: { open: 5.8 },
      shots: [
        {
          id: "shot1",
          label: "Open 1",
          category: "open",
          begin: 0,
          end: 5.8,
          speed: 1,
          flipH: false,
          lockFlipH: false,
        },
      ],
    });

    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:zip");
  });

  it("saves extracted zip entries into picked directory", async () => {
    const zip = new JSZip();
    zip.file("OPEN/shot1.mp4", new Uint8Array([1, 2, 3]));
    const blob = await zip.generateAsync({ type: "blob" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(blob),
      }),
    );

    const writeSpy = vi.fn().mockResolvedValue(undefined);
    const closeSpy = vi.fn().mockResolvedValue(undefined);
    const dirHandle = {
      name: "MyClips",
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({
          write: writeSpy,
          close: closeSpy,
        }),
      }),
    };
    dirHandle.getDirectoryHandle.mockResolvedValue(dirHandle);

    Object.defineProperty(window, "showDirectoryPicker", {
      value: vi.fn().mockResolvedValue(dirHandle),
      configurable: true,
    });

    const res = await sliceAndSaveToDirectory({
      sessionId: "s1",
      categoryMinDurations: { open: 5.8 },
      shots: [
        {
          id: "shot1",
          label: "Open 1",
          category: "open",
          begin: 0,
          end: 5.8,
          speed: 1,
          flipH: false,
          lockFlipH: false,
        },
      ],
    });

    expect(res).toEqual({ savedCount: 1, directoryName: "MyClips" });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("resets source session via /api/project", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await resetSourceSession({ projectId: "p1", sessionId: "s1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/project",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
