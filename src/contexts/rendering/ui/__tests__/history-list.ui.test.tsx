// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { FolderId } from "@/contexts/shared-kernel";

import type { RenderedRecord, RenderedRecordId } from "../../domain/types";
import { HistoryList } from "../history-list";

const sampleRecord: RenderedRecord = {
  id: "rec_1" as RenderedRecordId,
  folderId: "fld_1" as FolderId,
  tupleKey: "a|b|c|d|e",
  name: "Video Mix #1",
  outputUrl: Option.none(),
  status: "unused",
  renderedAt: "2026-11-17T10:00:00Z",
};

describe("rendering/ui/HistoryList", () => {
  it("renders empty state when there are no records", () => {
    render(<HistoryList records={[]} canEdit={true} onToggleUsed={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Chưa có video nào được render")).toBeInTheDocument();
  });

  it("toggles used status and deletes record", async () => {
    const user = userEvent.setup();
    const onToggleUsed = vi.fn();
    const onDelete = vi.fn();

    render(
      <HistoryList
        records={[sampleRecord]}
        canEdit={true}
        onToggleUsed={onToggleUsed}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Đánh dấu đã dùng" }));
    expect(onToggleUsed).toHaveBeenCalledWith("rec_1", true);

    await user.click(screen.getByRole("button", { name: "Xoá bản ghi Video Mix #1" }));
    expect(onDelete).toHaveBeenCalledWith("rec_1");
  });
});
