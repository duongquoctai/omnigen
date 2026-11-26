// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ClipId, FolderId, MediaUrl, Seconds } from "@/contexts/shared-kernel";

import type { ClipLibrary, PlannedVideo } from "../../domain/types";
import { PlannedVideosPanel } from "../planned-videos-panel";

const renderClientMocks = vi.hoisted(() => ({
  pollRenderProgress: vi.fn().mockResolvedValue({
    active: false,
    current: 0,
    total: 0,
    percent: 0,
    current_name: "",
  }),
  renderComposedBatch: vi.fn().mockResolvedValue({
    fileName: "Video #1.mp4",
    contentType: "video/mp4",
  }),
}));

vi.mock("@/shared/lib/render-client", () => renderClientMocks);

const emptyLibrary: ClipLibrary = {
  open: [],
  product: [],
  texture: [],
  apply: [],
  end: [],
};

const videos: ReadonlyArray<PlannedVideo> = [
  {
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
        flipH: false,
      },
    ],
  },
];

describe("composition/ui/PlannedVideosPanel", () => {
  it("renders single and batch videos via renderComposedBatch, inspects slots, and marks rendered", async () => {
    const user = userEvent.setup();
    const onToast = vi.fn();
    const onMarkRendered = vi.fn();
    const onUpdateSlot = vi.fn();

    render(
      <PlannedVideosPanel
        folderId={"fld_1" as FolderId}
        videos={videos}
        library={emptyLibrary}
        voices={[]}
        canEdit={true}
        onUpdateSlot={onUpdateSlot}
        onMarkRendered={onMarkRendered}
        onToast={onToast}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Xuất file MP4" }));
    await waitFor(() => {
      expect(renderClientMocks.renderComposedBatch).toHaveBeenCalledTimes(1);
      expect(onToast).toHaveBeenCalledWith({
        type: "success",
        text: 'Đã xuất xong "Video #1.mp4".',
      });
    });

    await user.click(screen.getByRole("button", { name: /Toàn bộ/ }));
    await waitFor(() => {
      expect(renderClientMocks.renderComposedBatch).toHaveBeenCalledTimes(2);
    });

    // Click slot badge OPEN to open inline scene inspector
    await user.click(screen.getByRole("button", { name: /OPEN/i }));
    expect(screen.getByText(/Tốc độ phát:/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "1.5x" }));
    expect(onUpdateSlot).toHaveBeenCalledWith("mix_1", 0, { speed: 1.5 });

    // Open Mark All Rendered modal and confirm
    await user.click(screen.getByRole("button", { name: /Đánh dấu đã render/i }));
    await user.click(screen.getByRole("button", { name: /Đồng ý đánh dấu/i }));
    await waitFor(() => {
      expect(onMarkRendered).toHaveBeenCalledWith(videos);
    });
  });
});
