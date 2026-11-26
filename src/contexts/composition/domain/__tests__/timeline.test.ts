import { Option } from "effect";
import { describe, expect, it } from "vitest";

import type { ClipId, MediaUrl, Seconds, SourceVideoId } from "@/contexts/shared-kernel";

import { computePlaybackRate, computeSlotTimelineDuration, resolveSlotAtTime } from "../timeline";
import type { PlannedSlot } from "../types";

const makeSlot = (
  enterBegin: number,
  exitEnd: number,
  videoBegin: number,
  videoEnd: number,
  speed = 1,
): PlannedSlot => ({
  category: "open",
  clipId: "c1" as ClipId,
  clipLabel: "Clip",
  sourceVideoId: "src_1" as SourceVideoId,
  videoBegin: videoBegin as Seconds,
  videoEnd: videoEnd as Seconds,
  enterBegin: enterBegin as Seconds,
  exitEnd: exitEnd as Seconds,
  localUrl: "/api/media/c1.mp4" as MediaUrl,
  speed,
  flipH: false,
});

describe("composition/domain/timeline", () => {
  it("returns None for empty slots", () => {
    expect(Option.isNone(resolveSlotAtTime([], 2, 10))).toBe(true);
  });

  it("resolves slot index, source time with speed, and playbackRate", () => {
    const slots = [makeSlot(0, 5, 10, 15, 1), makeSlot(5, 10, 0, 10, 2)];
    const pos = resolveSlotAtTime(slots, 7, 10);
    expect(Option.isSome(pos)).toBe(true);
    if (Option.isSome(pos)) {
      expect(pos.value.slotIndex).toBe(1);
      expect(pos.value.sourceTimeSec).toBe(4);
      expect(pos.value.playbackRate).toBe(2);
    }
  });

  it("clamps playbackRate between 0.25 and 4 and computes slot duration", () => {
    expect(computePlaybackRate(0.1)).toBe(0.25);
    expect(computePlaybackRate(8)).toBe(4);
    expect(computePlaybackRate(0)).toBe(1);
    expect(computeSlotTimelineDuration(makeSlot(2, 6, 0, 4))).toBe(4);
  });
});
