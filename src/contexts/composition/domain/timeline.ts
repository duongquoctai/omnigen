import { Option } from "effect";

import type { PlannedSlot } from "./types";

export interface ResolvedPlaybackPosition {
  readonly slotIndex: number;
  readonly slot: PlannedSlot;
  readonly sourceTimeSec: number;
  readonly playbackRate: number;
  readonly clampedTimelineSec: number;
}

export const computePlaybackRate = (speed: number): number =>
  Math.min(4, Math.max(0.25, speed > 0 ? speed : 1));

export const computeSlotTimelineDuration = (
  slot: Pick<PlannedSlot, "enterBegin" | "exitEnd">,
): number => Math.max(0.1, slot.exitEnd - slot.enterBegin);

export const resolveSlotAtTime = (
  slots: ReadonlyArray<PlannedSlot>,
  timelineSec: number,
  totalDuration: number,
): Option.Option<ResolvedPlaybackPosition> => {
  if (slots.length === 0) {
    return Option.none();
  }

  const safeTotal = Math.max(0.5, totalDuration);
  const clamped = Math.max(0, Math.min(safeTotal, timelineSec));

  const findIndexReverse = (idx: number): number => {
    if (idx < 0) return 0;
    const candidate = slots.at(idx);
    if (candidate && clamped >= candidate.enterBegin && clamped <= candidate.exitEnd + 0.05) {
      return idx;
    }
    return findIndexReverse(idx - 1);
  };

  const slotIndex = findIndexReverse(slots.length - 1);
  const slot = slots.at(slotIndex);
  if (!slot) {
    return Option.none();
  }

  const elapsed = Math.max(0, clamped - slot.enterBegin);
  const sourceTimeSec = Math.min(
    slot.videoEnd,
    slot.videoBegin + elapsed * (slot.speed > 0 ? slot.speed : 1),
  );

  return Option.some({
    slotIndex,
    slot,
    sourceTimeSec,
    playbackRate: computePlaybackRate(slot.speed),
    clampedTimelineSec: clamped,
  });
};
