// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Option } from "effect";
import { describe, expect, it, vi } from "vitest";

import type { Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";

import type { ClassifiedShot, Speed, TimeRange } from "../../domain/types";
import { ShotList } from "../shot-list";

const sampleShot: ClassifiedShot = {
  _tag: "ClassifiedShot",
  id: "s1" as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label: "Open (Hook) - Cảnh #1",
  range: { begin: 0 as Seconds, end: 5.8 as Seconds } as TimeRange,
  detectedRange: { begin: 0 as Seconds, end: 5.8 as Seconds } as TimeRange,
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

describe("footage/ui/ShotList", () => {
  it("renders empty state when shots list is empty", () => {
    render(
      <ShotList
        shots={[]}
        selectedShotId={null}
        canEdit={true}
        onSelect={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Chưa có cảnh nào được tách")).toBeInTheDocument();
  });

  it("renders shots and triggers select and delete", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onDelete = vi.fn();

    render(
      <ShotList
        shots={[sampleShot]}
        selectedShotId={"s1" as ShotId}
        canEdit={true}
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByText("Open (Hook) - Cảnh #1"));
    expect(onSelect).toHaveBeenCalledWith("s1");

    await user.click(screen.getByRole("button", { name: "Xoá cảnh Open (Hook) - Cảnh #1" }));
    expect(onDelete).toHaveBeenCalledWith("s1");
  });
});
