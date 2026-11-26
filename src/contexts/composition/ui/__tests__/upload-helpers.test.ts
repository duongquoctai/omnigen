import { describe, expect, it, vi } from "vitest";

import type { FolderId } from "@/contexts/shared-kernel";

import { uploadCategoryFiles, uploadVoiceFiles } from "../upload-helpers";

const uploadMocks = vi.hoisted(() => ({
  readVideoMetadata: vi.fn().mockResolvedValue({ duration: 8, width: 1080, height: 1920 }),
  uploadFileInChunks: vi.fn().mockResolvedValue({
    ok: true,
    url: "/api/media/fld_1/categories/open/a.mp4",
    localPath: "/tmp/a.mp4",
    fileName: "a.mp4",
    duration: 8,
  }),
}));

vi.mock("@/shared/lib/chunked-upload", () => uploadMocks);

describe("composition/ui/upload-helpers", () => {
  it("uploads category video files and voice files", async () => {
    const videoFile = new File(["vid"], "a.mp4", { type: "video/mp4" });
    const voiceFile = new File(["aud"], "v.mp3", { type: "audio/mpeg" });
    const onProgressText = vi.fn();

    const clips = await uploadCategoryFiles({
      folderId: "fld_1" as FolderId,
      category: "open",
      files: [videoFile] as unknown as FileList,
      onProgressText,
    });

    expect(clips).toHaveLength(1);
    expect(clips[0]?.category).toBe("open");
    expect(onProgressText).toHaveBeenCalled();

    const voices = await uploadVoiceFiles({
      folderId: "fld_1" as FolderId,
      files: [voiceFile] as unknown as FileList,
    });
    expect(voices).toHaveLength(1);
    expect(voices[0]?.name).toBe("v");
  });
});
