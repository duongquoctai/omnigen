// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";

import type { ClassifiedShot, Speed, TimeRange } from "../../domain/types";
import { SourceVideoPanel } from "../source-video-panel";

const uploadMocks = vi.hoisted(() => ({
  readVideoMetadata: vi.fn().mockResolvedValue({ duration: 25, width: 1080, height: 1920 }),
  uploadFileInChunks: vi.fn().mockResolvedValue({
    ok: true,
    url: "/api/media/sess_1/source/video.mp4",
    duration: 25,
  }),
}));

vi.mock("@/shared/lib/chunked-upload", () => uploadMocks);

const sampleShot: ClassifiedShot = {
  _tag: "ClassifiedShot",
  id: "s1" as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label: "Open #1",
  range: { begin: 1 as Seconds, end: 5 as Seconds } as TimeRange,
  detectedRange: { begin: 1 as Seconds, end: 5 as Seconds } as TimeRange,
  contentHash: Option.none(),
  category: "open",
  edits: {
    flip: { _tag: "Flipped", locked: false },
    speed: 1 as Speed,
    zoom: { _tag: "NoZoom" },
    crop: Option.none(),
    transition: { _tag: "NoTransition" },
  },
};

describe("footage/ui/SourceVideoPanel", () => {
  it("uploads source video via file input and notifies parent", async () => {
    const user = userEvent.setup();
    const onSourceUploaded = vi.fn();
    const onNotify = vi.fn();
    const videoRef = { current: null };

    const { container } = render(
      <SourceVideoPanel
        sessionId="sess_1"
        folderId="fld_1"
        sourceVideoUrl={null}
        maxVideoDuration={30}
        activeShot={null}
        canEdit={true}
        videoRef={videoRef}
        playingShotOnly={false}
        onTogglePlayingShotOnly={vi.fn()}
        onPlayheadChange={vi.fn()}
        onSourceUploaded={onSourceUploaded}
        onTrimShot={vi.fn()}
        onNotify={onNotify}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    if (fileInput) {
      await user.upload(fileInput as HTMLInputElement, file);
    }

    await waitFor(() => {
      expect(onSourceUploaded).toHaveBeenCalledWith({
        url: "/api/media/sess_1/source/video.mp4",
        duration: 25,
      });
      expect(onNotify).toHaveBeenCalledWith("success", expect.stringContaining("clip.mp4"));
    });
  });

  it("renders player controls and trimmer when sourceVideoUrl and activeShot exist", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onTrim = vi.fn();
    const videoRef = { current: null as HTMLVideoElement | null };

    render(
      <SourceVideoPanel
        sessionId="sess_1"
        folderId="fld_1"
        sourceVideoUrl="/api/media/sess_1/source/video.mp4"
        maxVideoDuration={30}
        activeShot={sampleShot}
        canEdit={true}
        videoRef={videoRef}
        playingShotOnly={true}
        onTogglePlayingShotOnly={onToggle}
        onPlayheadChange={vi.fn()}
        onSourceUploaded={vi.fn()}
        onTrimShot={onTrim}
        onNotify={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Phát video" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đang lặp cảnh đang chọn" }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Xem đầu cảnh" }));
    fireEvent.mouseDown(screen.getByRole("slider", { name: "Điểm bắt đầu cảnh" }), {
      clientX: 10,
    });
    fireEvent.mouseMove(window, { clientX: 20 });
    fireEvent.mouseUp(window);
    expect(onTrim).toHaveBeenCalled();
  });
});
