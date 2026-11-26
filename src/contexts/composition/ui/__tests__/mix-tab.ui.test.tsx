// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ClipId, FolderId, MediaUrl, Seconds, VoiceId } from "@/contexts/shared-kernel";

import type { ClipLibrary, DriveFileId } from "../../domain/types";
import { MixTab } from "../mix-tab";
import { clearStoredPlannedVideos } from "../planned-videos-store";

const actionMocks = vi.hoisted(() => ({
  ingestDriveLinksAction: vi.fn(),
  ingestDriveVoicesAction: vi.fn(),
  removeClipAction: vi.fn(),
  clearCategoryAction: vi.fn(),
  removeVoiceAction: vi.fn(),
  planMixAction: vi.fn(),
}));

vi.mock("../actions", () => actionMocks);

const emptyLibrary: ClipLibrary = {
  open: [],
  product: [],
  texture: [],
  apply: [],
  end: [],
};

describe("composition/ui/MixTab", () => {
  it("ingests drive clip, adds voice, and plans mix", async () => {
    const user = userEvent.setup();
    const onToast = vi.fn();
    const folderId = "fld_1" as FolderId;
    clearStoredPlannedVideos(folderId);
    const sampleId = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345" as DriveFileId;

    actionMocks.ingestDriveLinksAction.mockResolvedValue({
      ok: true,
      data: {
        addedCount: 1,
        clips: [
          {
            id: `drv_${sampleId}` as ClipId,
            name: "Open Clip" as never,
            fileName: "open.mp4" as never,
            category: "open",
            duration: 4 as Seconds,
            source: {
              _tag: "DriveClip",
              fileId: sampleId,
              streamUrl: `/api/drive-stream/${sampleId}` as MediaUrl,
            },
            lockFlipH: false,
            contentHash: null,
          },
        ],
        skippedUrls: [],
      },
    });
    actionMocks.ingestDriveVoicesAction.mockResolvedValue({
      ok: true,
      data: {
        addedCount: 1,
        voices: [
          {
            id: `drv_voice_${sampleId}` as VoiceId,
            name: "Voice #1" as never,
            fileName: "v1.mp3" as never,
            localUrl: `/api/drive-stream/${sampleId}` as MediaUrl,
            localPath: null,
            duration: 10 as Seconds,
          },
        ],
        skippedUrls: [],
      },
    });
    actionMocks.planMixAction.mockResolvedValue({
      ok: true,
      data: {
        _tag: "MixPlanned",
        folderId,
        videos: [
          {
            id: "mix_1" as never,
            name: "Video #1",
            tuple: {
              open: `drv_${sampleId}` as ClipId,
              product: `drv_${sampleId}` as ClipId,
              texture: `drv_${sampleId}` as ClipId,
              apply: `drv_${sampleId}` as ClipId,
              end: `drv_${sampleId}` as ClipId,
            },
            finalDuration: 15 as Seconds,
            slots: [
              {
                category: "open",
                clipId: `drv_${sampleId}` as ClipId,
                clipLabel: "Open Clip",
                sourceVideoId: "src_1" as never,
                videoBegin: 0 as Seconds,
                videoEnd: 4 as Seconds,
                enterBegin: 0 as Seconds,
                exitEnd: 4 as Seconds,
                localUrl: `/api/drive-stream/${sampleId}` as MediaUrl,
                speed: 1,
                flipH: false,
              },
            ],
          },
        ],
      },
    });

    actionMocks.removeClipAction.mockResolvedValue({
      ok: true,
      data: { clipId: `drv_${sampleId}` },
    });
    actionMocks.removeVoiceAction.mockResolvedValue({
      ok: true,
      data: { voiceId: `drv_voice_${sampleId}` },
    });

    render(
      <MixTab
        folderId={folderId}
        initialLibrary={emptyLibrary}
        initialVoices={[]}
        canEdit={true}
        onToast={onToast}
      />,
    );

    // Open Google Drive Import drawer -> switch to "Đang xử lý" tab to add clips & voices
    await user.click(screen.getByRole("button", { name: /Google Drive Import/i }));
    await user.click(screen.getByRole("button", { name: /Đang xử lý/i }));

    const addButtons = screen.getAllByRole("button", { name: /Thêm link Drive/i });
    const firstAddBtn = addButtons.at(0);
    if (!firstAddBtn) {
      throw new Error("Missing Link Drive button");
    }
    await user.click(firstAddBtn);
    await user.type(
      screen.getByPlaceholderText("https://drive.google.com/file/d/..."),
      `https://drive.google.com/file/d/${sampleId}/view`,
    );
    await user.click(screen.getByRole("button", { name: "Nhập clip Drive" }));

    await waitFor(() => {
      expect(screen.getByText("Open Clip")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Khoá lật clip Open Clip" }));
    await user.click(screen.getByRole("button", { name: "Xem trước clip Open Clip" }));
    expect(screen.getAllByText("Open Clip").length).toBeGreaterThanOrEqual(2);
    // Close preview modal via its close trigger or Escape
    const previewCloseBtns = screen.getAllByRole("button", { name: /Dismiss|Close/i });
    const topClose = previewCloseBtns.at(-1);
    if (topClose) {
      await user.click(topClose);
    } else {
      await user.keyboard("{Escape}");
    }

    // Add voice via Voice card Link Drive modal inside drawer
    const linkDriveBtns = screen.getAllByRole("button", { name: "Link Drive" });
    const voiceLinkBtn = linkDriveBtns.at(-1);
    if (!voiceLinkBtn) {
      throw new Error("Missing Voice Link Drive button");
    }
    await user.click(voiceLinkBtn);
    await user.type(
      screen.getByPlaceholderText("Dán link Google Drive file voice (.mp3/.wav)..."),
      `https://drive.google.com/open?id=${sampleId}`,
    );
    await user.click(screen.getByRole("button", { name: "Thêm voice" }));

    await waitFor(() => {
      expect(screen.getByText("Voice #1")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Xoá clip Open Clip" }));
    await user.click(screen.getByRole("button", { name: "Xoá voice Voice #1" }));

    await waitFor(() => {
      expect(actionMocks.removeClipAction).toHaveBeenCalled();
      expect(actionMocks.removeVoiceAction).toHaveBeenCalled();
    });

    // Close drawer via Close button and click Trộn on main board
    const drawerCloseBtns = screen.getAllByRole("button", { name: /Dismiss|Close/i });
    const drawerClose = drawerCloseBtns.at(0);
    if (drawerClose) {
      await user.click(drawerClose);
    } else {
      await user.keyboard("{Escape}");
    }
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Trộn" }));

    await waitFor(() => {
      expect(actionMocks.planMixAction).toHaveBeenCalled();
      expect(screen.getAllByText(/Video #1/).length).toBeGreaterThanOrEqual(1);
      expect(onToast).toHaveBeenCalledWith({
        type: "success",
        text: "Đã tạo 1 tổ hợp video mới.",
      });
    });
  }, 15000);

  it("deduplicates re-ingested Drive IDs and clears clips, voices, and planned videos on Xóa", async () => {
    const user = userEvent.setup();
    const onToast = vi.fn();
    const folderId = "fld_1" as FolderId;
    clearStoredPlannedVideos(folderId);
    const sampleId = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345" as DriveFileId;

    actionMocks.clearCategoryAction.mockResolvedValue({ ok: true, data: { cleared: true } });
    actionMocks.removeVoiceAction.mockResolvedValue({
      ok: true,
      data: { voiceId: `drv_voice_${sampleId}` },
    });
    actionMocks.ingestDriveVoicesAction.mockResolvedValue({
      ok: true,
      data: {
        addedCount: 1,
        voices: [
          {
            id: `drv_voice_${sampleId}` as VoiceId,
            name: "Voice Dup" as never,
            fileName: "v1.mp3" as never,
            localUrl: `/api/drive-stream/${sampleId}` as MediaUrl,
            localPath: null,
            duration: 10 as Seconds,
          },
        ],
        skippedUrls: [],
      },
    });

    render(
      <MixTab
        folderId={folderId}
        initialLibrary={emptyLibrary}
        initialVoices={[
          {
            id: `drv_voice_${sampleId}` as VoiceId,
            name: "Voice Dup",
            fileName: "v1.mp3",
            localUrl: `/api/drive-stream/${sampleId}` as MediaUrl,
            localPath: { _tag: "None" } as never,
            duration: 10 as Seconds,
          },
        ]}
        canEdit={true}
        onToast={onToast}
      />,
    );

    // Open Google Drive Import drawer -> switch to Đang xử lý -> re-ingest same voice ID -> should remain 1 voice
    await user.click(screen.getByRole("button", { name: /^Google Drive Import/i }));
    await user.click(screen.getByRole("button", { name: /Đang xử lý/i }));

    const linkDriveBtns = screen.getAllByRole("button", { name: "Link Drive" });
    const voiceBtn = linkDriveBtns.at(-1);
    if (!voiceBtn) throw new Error("Missing Voice Link Drive button");
    await user.click(voiceBtn);
    await user.type(
      screen.getByPlaceholderText("Dán link Google Drive file voice (.mp3/.wav)..."),
      `https://drive.google.com/open?id=${sampleId}`,
    );
    await user.click(screen.getByRole("button", { name: "Thêm voice" }));

    await waitFor(() => {
      expect(screen.getAllByText("Voice Dup")).toHaveLength(1);
    });

    // Close drawer, click Xóa -> Confirm Xoá toàn bộ -> clears voices too
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.click(screen.getByRole("button", { name: "Xoá toàn bộ" }));

    await waitFor(() => {
      expect(actionMocks.removeVoiceAction).toHaveBeenCalledWith({
        folderId,
        voiceId: `drv_voice_${sampleId}`,
      });
      expect(screen.queryByText("Voice Dup")).not.toBeInTheDocument();
    });
  }, 15000);
});
