// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { ClipId, MediaUrl, Seconds, VoiceId } from "@/contexts/shared-kernel";

import type { ClipLibrary, DriveFileId, VoiceClip } from "../../domain/types";
import { DriveQuickCheck } from "../drive-quick-check";

const sampleId = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345" as DriveFileId;
const voiceId = "9aBcDeFgHiJkLmNoPqRsTuVwXyZ12345" as DriveFileId;

const library: ClipLibrary = {
  open: [
    {
      id: `drv_${sampleId}` as ClipId,
      name: "Open Clip",
      fileName: "open.mp4",
      category: "open",
      duration: 4 as Seconds,
      source: {
        _tag: "DriveClip",
        fileId: sampleId,
        streamUrl: `/api/drive-stream/${sampleId}` as MediaUrl,
      },
      lockFlipH: false,
      contentHash: Option.none(),
    },
  ],
  product: [],
  texture: [],
  apply: [],
  end: [],
};

const voices: ReadonlyArray<VoiceClip> = [
  {
    id: `drv_voice_${voiceId}` as VoiceId,
    name: "Voice 1",
    fileName: "v1.mp3",
    localUrl: `/api/drive-stream/${voiceId}` as MediaUrl,
    localPath: Option.none(),
    duration: 10 as Seconds,
  },
];

describe("composition/ui/DriveQuickCheck", () => {
  it("checks Drive links against library and switches category filter", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();

    render(
      <DriveQuickCheck
        library={library}
        voices={voices}
        activeFilter="all"
        onFilterChange={onFilterChange}
      />,
    );

    const input = screen.getByPlaceholderText(
      "Kiểm tra nhanh: Dán link Google Drive hoặc File ID vào đây để kiểm tra đã nạp chưa...",
    );
    await user.type(input, `https://drive.google.com/file/d/${sampleId}/view`);
    expect(screen.getByText(/Đã có trong kho \(Open: Open Clip\)/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "bad-link");
    expect(
      screen.getByText(/Không nhận diện được Google Drive File ID hợp lệ/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Product" }));
    expect(onFilterChange).toHaveBeenCalledWith("product");
  });
});
