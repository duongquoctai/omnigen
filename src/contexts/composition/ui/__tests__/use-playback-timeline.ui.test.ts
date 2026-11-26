// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ClipId, MediaUrl, Seconds, SourceVideoId } from "@/contexts/shared-kernel";

import type { PlannedSlot } from "../../domain/types";
import { usePlaybackTimeline } from "../use-playback-timeline";

const sampleSlots: ReadonlyArray<PlannedSlot> = [
  {
    category: "open",
    clipId: "c1" as ClipId,
    clipLabel: "Open",
    sourceVideoId: "src_1" as SourceVideoId,
    videoBegin: 0 as Seconds,
    videoEnd: 5 as Seconds,
    enterBegin: 0 as Seconds,
    exitEnd: 5 as Seconds,
    localUrl: "/api/media/c1.mp4" as MediaUrl,
    speed: 1,
    flipH: false,
  },
  {
    category: "product",
    clipId: "c2" as ClipId,
    clipLabel: "Product",
    sourceVideoId: "src_1" as SourceVideoId,
    videoBegin: 0 as Seconds,
    videoEnd: 5 as Seconds,
    enterBegin: 5 as Seconds,
    exitEnd: 10 as Seconds,
    localUrl: "/api/media/c2.mp4" as MediaUrl,
    speed: 1,
    flipH: false,
  },
];

describe("composition/ui/usePlaybackTimeline", () => {
  it("seeks, plays, and pauses cleanly", () => {
    const onPositionChange = vi.fn();
    const { result } = renderHook(() =>
      usePlaybackTimeline({
        slots: sampleSlots,
        totalDuration: 10,
        onPositionChange,
      }),
    );

    act(() => {
      result.current.seekTo(6.5);
    });
    expect(result.current.timelineSec).toBe(6.5);
    expect(result.current.activeSlotIndex).toBe(1);
    expect(onPositionChange).toHaveBeenCalledWith(6.5, 1);

    act(() => {
      result.current.play();
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPlaying).toBe(false);
  });
});
