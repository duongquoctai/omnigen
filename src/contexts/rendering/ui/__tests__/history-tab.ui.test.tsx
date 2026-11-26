// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { VoiceClip } from "@/contexts/composition";
import type { FolderId, MediaUrl, Seconds, VoiceId } from "@/contexts/shared-kernel";

import type { RenderedRecord, RenderedRecordId } from "../../domain/types";
import { HistoryTab } from "../history-tab";

const actionMocks = vi.hoisted(() => ({
  toggleRecordUsedAction: vi.fn(),
  deleteRenderedRecordAction: vi.fn(),
  clearRenderedHistoryAction: vi.fn(),
  listRenderedHistoryAction: vi.fn(),
}));

vi.mock("../actions", () => actionMocks);

describe("rendering/ui/HistoryTab", () => {
  it("filters, searches, opens detail drawer, toggles used switch, and deletes rendered records", async () => {
    const user = userEvent.setup();
    const onToast = vi.fn();
    const voices: ReadonlyArray<VoiceClip> = [
      {
        id: "v_1" as VoiceId,
        name: "v1",
        fileName: "v1.mp3",
        localUrl: "/api/media/v1.mp3" as MediaUrl,
        localPath: Option.none(),
        duration: 20 as Seconds,
      },
    ];
    const records: ReadonlyArray<RenderedRecord> = [
      {
        id: "rec_1" as RenderedRecordId,
        folderId: "fld_1" as FolderId,
        tupleKey: "a|b|c|d|e",
        name: "Video #1",
        outputUrl: Option.some("/api/media/out1.mp4" as MediaUrl),
        status: "unused",
        renderedAt: "2026-11-18T10:00:00Z",
        payload: {
          finalDuration: 21.4,
          voiceTrackId: "v_1",
          slots: [
            {
              category: "open",
              shotLabel: "04_open-1",
              localUrl: "/api/drive-stream/drive_open_1",
              videoBegin: 0,
              videoEnd: 4.5,
              speed: 1,
              flipH: false,
            },
            {
              category: "product",
              shotLabel: "03_prod-1",
              localUrl: "/api/media/prod.mp4",
              videoBegin: 0,
              videoEnd: 4.0,
              speed: 1,
              flipH: false,
            },
          ],
        },
      },
      {
        id: "rec_2" as RenderedRecordId,
        folderId: "fld_1" as FolderId,
        tupleKey: "f|g|h|i|j",
        name: "Serum Clip",
        outputUrl: Option.some("/api/media/out2.mp4" as MediaUrl),
        status: "used",
        renderedAt: "2026-11-19T10:00:00Z",
      },
    ];

    actionMocks.toggleRecordUsedAction.mockResolvedValue({
      ok: true,
      data: { _tag: "RecordStatusChanged", recordId: "rec_1", status: "used" },
    });
    actionMocks.deleteRenderedRecordAction.mockResolvedValue({
      ok: true,
      data: { recordId: "rec_1" },
    });

    render(
      <HistoryTab
        folderId={"fld_1" as FolderId}
        initialRecords={records}
        voices={voices}
        canEdit={true}
        onToast={onToast}
      />,
    );

    // Duration & voice & scene badges visible in table
    expect(screen.getByText("21.4s")).toBeInTheDocument();
    expect(screen.getByText("04_open-1")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();

    // Search
    const searchInput = screen.getByPlaceholderText("Tìm theo tên video, cảnh...");
    await user.type(searchInput, "Serum");
    expect(screen.getByText("Serum Clip")).toBeInTheDocument();
    expect(screen.queryByText("Video #1")).not.toBeInTheDocument();
    await user.clear(searchInput);

    // Filter unused
    await user.click(screen.getByRole("button", { name: /Chưa sử dụng/ }));
    expect(screen.getByText("Video #1")).toBeInTheDocument();
    expect(screen.queryByText("Serum Clip")).not.toBeInTheDocument();

    // Back to All
    await user.click(screen.getByRole("button", { name: /Tất cả/ }));

    // Click row to open Detail Drawer
    await user.click(screen.getByText("Video #1"));
    expect(screen.getByText("Chi tiết 5 cảnh trong tổ hợp")).toBeInTheDocument();
    expect(screen.getByText("Link Google Drive")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đóng" }));

    // Toggle used switch
    const switchEl = screen.getByRole("switch", {
      name: "Trạng thái sử dụng của Video #1",
    });
    await user.click(switchEl);
    await waitFor(() => {
      expect(actionMocks.toggleRecordUsedAction).toHaveBeenCalledWith({
        recordId: "rec_1",
        used: true,
      });
    });

    // Delete single via ConfirmDialog
    await user.click(screen.getByRole("button", { name: "Xóa Video #1" }));
    await user.click(screen.getByRole("button", { name: "Xóa khỏi lịch sử" }));
    await waitFor(() => {
      expect(actionMocks.deleteRenderedRecordAction).toHaveBeenCalledWith({
        recordId: "rec_1",
      });
      expect(onToast).toHaveBeenCalledWith({
        type: "success",
        text: 'Đã xóa "Video #1" khỏi lịch sử.',
      });
    });
  });
});
