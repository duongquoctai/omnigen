// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import type { FolderId, Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";
import { StudioShell } from "@/contexts/workspace";

import type { ClassifiedShot, Speed, TimeRange } from "../../domain/types";
import { SplitTab } from "../split-tab";

const actionMocks = vi.hoisted(() => ({
  detectScenesAction: vi.fn(),
  sliceShotsAction: vi.fn(),
  publishShotsAction: vi.fn(),
}));

const exportMocks = vi.hoisted(() => ({
  sliceAndDownloadZip: vi.fn().mockResolvedValue(undefined),
  sliceAndSaveToDirectory: vi.fn().mockResolvedValue({ savedCount: 1, directoryName: "Clips" }),
  resetSourceSession: vi.fn().mockResolvedValue(undefined),
}));

const uploadMocks = vi.hoisted(() => ({
  uploadFileInChunks: vi.fn().mockResolvedValue({
    ok: true,
    url: "/api/media/sess_1/source/uploaded.mp4",
    localPath: "/tmp/uploaded.mp4",
    fileName: "uploaded.mp4",
    duration: 24,
    width: 576,
    height: 1024,
  }),
}));

vi.mock("../actions", () => actionMocks);
vi.mock("@/shared/lib/slice-export-client", () => exportMocks);
vi.mock("@/shared/lib/chunked-upload", () => uploadMocks);

const initialShot: ClassifiedShot = {
  _tag: "ClassifiedShot",
  id: "s1" as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label: "Open #1",
  range: { begin: 0 as Seconds, end: 6 as Seconds } as TimeRange,
  detectedRange: { begin: 0 as Seconds, end: 6 as Seconds } as TimeRange,
  contentHash: Option.none(),
  category: "open",
  edits: {
    flip: { _tag: "Unflipped", locked: false },
    speed: 1 as Speed,
    zoom: { _tag: "NoZoom" },
    crop: Option.none(),
    transition: { _tag: "NoTransition" },
  },
};

describe("footage/ui/SplitTab", () => {
  it("renders 4-row HeroUI studio layout, supports inline edit, shortcuts, detect, and export", async () => {
    const user = userEvent.setup();
    actionMocks.detectScenesAction.mockResolvedValue({
      ok: true,
      data: {
        totalScenes: 1,
        totalDetected: 1,
        slowMoCount: 0,
        shots: [
          {
            id: "s1",
            sourceVideoId: "src_1",
            label: "Open #1",
            begin: 0,
            end: 6,
            rawBegin: 0,
            rawEnd: 6,
            category: "open",
            edits: {
              flipH: false,
              lockFlipH: false,
              speed: 1,
              zoom: false,
              transition: null,
            },
          },
        ],
      },
    });

    render(
      <NuqsTestingAdapter>
        <StudioShell accessRole={{ _tag: "Owner" }}>
          <SplitTab
            sessionId="sess_1"
            folderId={"fld_1" as FolderId}
            initialShots={[initialShot]}
            initialSourceVideoUrl="/api/media/sess_1/source/demo.mp4"
            maxVideoDuration={30}
          />
        </StudioShell>
      </NuqsTestingAdapter>,
    );

    expect(screen.getByText("Upload 1 video gốc để tách")).toBeInTheDocument();
    expect(screen.getByText("1 cảnh")).toBeInTheDocument();
    expect(
      screen.getByText("Kho video theo 5 category (đã tách từ video gốc)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Timeline phân đoạn")).toBeInTheDocument();
    expect(screen.getByText("Gán nhóm")).toBeInTheDocument();

    // Monitor loop toggle: play then stop calls video.pause()
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

    await user.click(screen.getByRole("button", { name: "Xem riêng" }));
    expect(screen.getByRole("button", { name: "Dừng lặp" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dừng lặp" }));
    expect(pauseSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Xem riêng" })).toBeInTheDocument();

    // Open inline edit accordion via pencil button
    await user.click(screen.getByRole("button", { name: "Chỉnh sửa Open #1" }));
    expect(screen.getByText("Tùy chọn nâng cao")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lật gương" }));
    await user.click(screen.getByRole("button", { name: "1.5x" }));
    expect(screen.getAllByText("1.5x").length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByRole("button", { name: /Khoá chữ \(L\)/i }));
    expect(screen.getByText("LOCKED")).toBeInTheDocument();

    // Split button creates P1 and P2
    await user.click(screen.getByRole("button", { name: "Tách (S)" }));
    expect(screen.getByText("Open #1 (P1)")).toBeInTheDocument();

    // Auto detect
    await user.click(screen.getByRole("button", { name: "Auto detect" }));
    await waitFor(() => {
      expect(actionMocks.detectScenesAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sess_1",
          detector: "content",
          threshold: 27,
          minSceneLen: 0.8,
        }),
      );
    });

    // Export ZIP & Save to directory
    await user.click(screen.getByRole("button", { name: "Toàn bộ" }));
    await waitFor(() => {
      expect(exportMocks.sliceAndDownloadZip).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Lưu về máy" }));
    await waitFor(() => {
      expect(exportMocks.sliceAndSaveToDirectory).toHaveBeenCalledTimes(1);
    });

    // Keyboard shortcut '2' classifies selected shot to product
    await user.keyboard("2");
    expect(screen.getByText("NHÓM PRODUCT")).toBeInTheDocument();

    // Monitor seek & merge buttons
    await user.click(screen.getByRole("button", { name: "Đầu cảnh" }));
    await user.click(screen.getByRole("button", { name: "Cuối cảnh" }));

    // Add manual shot, switch category auto-selects shot in monitor, and reset
    await user.click(screen.getByRole("button", { name: /^PRODUCT\s/ }));
    await user.click(screen.getByRole("button", { name: "Thêm shot" }));
    expect(screen.getByText("NHÓM PRODUCT")).toBeInTheDocument();
    expect(screen.getByText(/Đang chọn: Cảnh thủ công/i)).toBeInTheDocument();

    // Add a shot in OPEN, then switch to PRODUCT -> monitor automatically switches selected shot category
    await user.click(screen.getByRole("button", { name: /^OPEN\s/ }));
    await user.click(screen.getByRole("button", { name: "Thêm shot" }));
    expect(screen.getByText(/\(OPEN\)/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^PRODUCT\s/ }));
    expect(screen.getByText(/\(PRODUCT\)/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Video tiếp theo" }));
    await waitFor(() => {
      expect(exportMocks.resetSourceSession).toHaveBeenCalledTimes(1);
    });
  }, 15000);

  it("automatically triggers scene detection after uploading a source video", async () => {
    const user = userEvent.setup();
    actionMocks.detectScenesAction.mockClear();
    actionMocks.detectScenesAction.mockResolvedValue({
      ok: true,
      data: {
        totalScenes: 1,
        totalDetected: 1,
        slowMoCount: 0,
        shots: [
          {
            id: "s_auto",
            sourceVideoId: "src_1",
            label: "Open Auto",
            begin: 0,
            end: 6,
            rawBegin: 0,
            rawEnd: 6,
            category: "open",
            edits: {
              flipH: false,
              lockFlipH: false,
              speed: 1,
              zoom: false,
              transition: null,
            },
          },
        ],
      },
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-preview");

    render(
      <NuqsTestingAdapter>
        <StudioShell accessRole={{ _tag: "Owner" }}>
          <SplitTab
            sessionId="sess_1"
            folderId={"fld_1" as FolderId}
            initialShots={[]}
            maxVideoDuration={30}
          />
        </StudioShell>
      </NuqsTestingAdapter>,
    );

    const fileInput = screen.getByLabelText("Chọn video gốc để tách");
    const file = new File(["video-bytes"], "demo.mp4", { type: "video/mp4" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(uploadMocks.uploadFileInChunks).toHaveBeenCalledTimes(1);
      expect(actionMocks.detectScenesAction).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Open Auto")).toBeInTheDocument();
  });
});
