// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ClipId, MediaUrl, Seconds } from "@/contexts/shared-kernel";

import type { PlannedVideo } from "../../domain/types";
import { PreviewPlayer916 } from "../preview-player-916";

const video: PlannedVideo = {
  id: "mix_1" as never,
  name: "Video #1",
  tuple: {
    open: "c1" as ClipId,
    product: "c1" as ClipId,
    texture: "c1" as ClipId,
    apply: "c1" as ClipId,
    end: "c1" as ClipId,
  },
  totalVisualDuration: 4 as Seconds,
  finalDuration: 4 as Seconds,
  voiceId: Option.none(),
  syncMode: "video_master",
  slots: [
    {
      category: "open",
      clipId: "c1" as ClipId,
      clipLabel: "Clip A",
      sourceVideoId: "src_1" as never,
      videoBegin: 0 as Seconds,
      videoEnd: 4 as Seconds,
      enterBegin: 0 as Seconds,
      exitEnd: 4 as Seconds,
      localUrl: "/api/media/a.mp4" as MediaUrl,
      speed: 1,
      flipH: true,
    },
  ],
};

describe("composition/ui/PreviewPlayer916", () => {
  it("renders 9:16 phone frame in full and slot mode, toggles play/restart/mute", async () => {
    const user = userEvent.setup();
    const onPlayingChange = vi.fn();

    const { rerender } = render(
      <PreviewPlayer916
        video={video}
        voiceUrl="/api/media/v.mp3"
        enableVoice={true}
        previewMode="full"
        onPlayingChange={onPlayingChange}
      />,
    );

    expect(screen.getByText(/Cảnh OPEN \(1\/1\)/i)).toBeInTheDocument();
    expect(screen.getByText("MIRROR")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Phát" }));
    expect(onPlayingChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Tạm dừng" }));
    expect(onPlayingChange).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("button", { name: "Bật/tắt tiếng voice" }));
    await user.click(screen.getByRole("button", { name: "Phát lại từ đầu" }));

    rerender(
      <PreviewPlayer916
        video={video}
        voiceUrl="/api/media/v.mp3"
        enableVoice={true}
        previewMode="slot"
        isolatedSlotIndex={0}
      />,
    );

    expect(screen.getByText(/Cảnh OPEN \(Xem riêng\)/i)).toBeInTheDocument();
  });
});
