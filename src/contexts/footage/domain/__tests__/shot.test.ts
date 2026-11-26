import { Option, Result } from "effect";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";

import {
  applyMinDuration,
  classifyShot,
  computeSpeedForMinDuration,
  DEFAULT_MIN_DURATIONS,
  deleteShot,
  mergeShotWithNext,
  publishableShots,
  setShotSpeed,
  setShotZoom,
  splitShotAt,
  toggleShotFlip,
  toggleShotFlipLock,
  trimShot,
} from "../shot";
import type { DraftShot, Shot, Speed, TimeRange } from "../types";

const makeDraftShot = (id: string, begin: number, end: number, label = "Scene 1"): DraftShot => ({
  _tag: "DraftShot",
  id: id as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label,
  range: { begin: begin as Seconds, end: end as Seconds } as TimeRange,
  detectedRange: { begin: begin as Seconds, end: end as Seconds } as TimeRange,
  contentHash: Option.none(),
  edits: {
    flip: { _tag: "Unflipped", locked: false },
    speed: 1 as Speed,
    zoom: { _tag: "NoZoom" },
    crop: Option.none(),
    transition: { _tag: "NoTransition" },
  },
});

describe("footage/domain/shot", () => {
  it("computes bounded speed for min duration property", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 30, noNaN: true }),
        fc.double({ min: 0.5, max: 15, noNaN: true }),
        (rawDur, minDur) => {
          const speed = computeSpeedForMinDuration(rawDur, minDur);
          expect(speed).toBeGreaterThanOrEqual(0.1);
          expect(speed).toBeLessThanOrEqual(1);
          if (rawDur >= minDur) {
            expect(speed).toBe(1);
          }
        },
      ),
    );
  });

  it("applies min duration only to ClassifiedShot", () => {
    const draft = makeDraftShot("s1", 0, 2.9);
    expect(applyMinDuration(draft, DEFAULT_MIN_DURATIONS)).toBe(draft);

    const classified = classifyShot(draft, "open", DEFAULT_MIN_DURATIONS);
    expect(classified._tag).toBe("ClassifiedShot");
    expect(classified.edits.speed).toBe(0.5);
  });

  it("splits a shot at targetSec and supports midpoint fallback", () => {
    const s1 = makeDraftShot("s1", 0, 10, "Hook");
    const res = splitShotAt([s1], "s1" as ShotId, 4.24, "s2" as ShotId, DEFAULT_MIN_DURATIONS);
    expect(Result.isSuccess(res)).toBe(true);
    if (Result.isSuccess(res)) {
      const [next, newId] = res.success;
      expect(newId).toBe("s2");
      expect(next).toHaveLength(2);
      expect(next.at(0)?.range).toEqual({ begin: 0, end: 4.2 });
      expect(next.at(0)?.label).toBe("Hook (P1)");
      expect(next.at(1)?.range).toEqual({ begin: 4.2, end: 10 });
      expect(next.at(1)?.label).toBe("Hook (P2)");
    }

    // Outside targetSec falls back to midpoint (5.0)
    const midRes = splitShotAt([s1], "s1" as ShotId, 99, "s2" as ShotId, DEFAULT_MIN_DURATIONS);
    expect(Result.isSuccess(midRes)).toBe(true);
    if (Result.isSuccess(midRes)) {
      expect(midRes.success[0].at(0)?.range.end).toBe(5);
    }
  });

  it("fails split on missing shot or too-short shot", () => {
    const short = makeDraftShot("s1", 1, 1.4);
    const shortErr = splitShotAt(
      [short],
      "s1" as ShotId,
      1.2,
      "s2" as ShotId,
      DEFAULT_MIN_DURATIONS,
    );
    expect(Result.isFailure(shortErr)).toBe(true);
    if (Result.isFailure(shortErr)) {
      expect(shortErr.failure._tag).toBe("SplitPointOutOfRange");
    }

    const notFound = splitShotAt(
      [short],
      "missing" as ShotId,
      1.2,
      "s2" as ShotId,
      DEFAULT_MIN_DURATIONS,
    );
    expect(Result.isFailure(notFound)).toBe(true);
    if (Result.isFailure(notFound)) {
      expect(notFound.failure._tag).toBe("ShotNotFound");
    }
  });

  it("property: split then merge preserves original range", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 2, max: 30 }),
        (beginInt, lenInt) => {
          const begin = beginInt;
          const end = beginInt + lenInt;
          const shot = makeDraftShot("s1", begin, end);
          const splitRes = splitShotAt(
            [shot],
            "s1" as ShotId,
            begin + lenInt / 2,
            "s2" as ShotId,
            DEFAULT_MIN_DURATIONS,
          );
          if (Result.isFailure(splitRes)) return false;
          const [splitShots] = splitRes.success;
          const mergeRes = mergeShotWithNext(splitShots, "s1" as ShotId, DEFAULT_MIN_DURATIONS);
          if (Result.isFailure(mergeRes)) return false;
          const [mergedShots] = mergeRes.success;
          expect(mergedShots).toHaveLength(1);
          expect(mergedShots.at(0)?.range.begin).toBe(begin);
          expect(mergedShots.at(0)?.range.end).toBe(end);
          return true;
        },
      ),
    );
  });

  it("fails merge when there is no next shot or shot is missing", () => {
    const s1 = makeDraftShot("s1", 0, 5);
    const noNext = mergeShotWithNext([s1], "s1" as ShotId, DEFAULT_MIN_DURATIONS);
    expect(Result.isFailure(noNext)).toBe(true);
    if (Result.isFailure(noNext)) {
      expect(noNext.failure._tag).toBe("NoNextShotToMerge");
    }

    const missing = mergeShotWithNext([s1], "s9" as ShotId, DEFAULT_MIN_DURATIONS);
    expect(Result.isFailure(missing)).toBe(true);
    if (Result.isFailure(missing)) {
      expect(missing.failure._tag).toBe("ShotNotFound");
    }
  });

  it("trims, flips, locks, sets speed/zoom, deletes, and filters publishable shots", () => {
    const s1 = makeDraftShot("s1", 1, 5);
    const trimmed = trimShot(s1, -2, 12, 8, DEFAULT_MIN_DURATIONS);
    expect(trimmed.range).toEqual({ begin: 0, end: 8 });

    const flipped = toggleShotFlip(trimmed);
    expect(flipped.edits.flip).toEqual({ _tag: "Flipped", locked: false });
    expect(toggleShotFlip(flipped).edits.flip).toEqual({ _tag: "Unflipped", locked: false });

    const locked = toggleShotFlipLock(flipped);
    expect(locked.edits.flip.locked).toBe(true);

    const sped = setShotSpeed(locked, 1.5 as Speed);
    expect(sped.edits.speed).toBe(1.5);

    const zoomed = setShotZoom(sped, { _tag: "AutoZoom" });
    expect(zoomed.edits.zoom).toEqual({ _tag: "AutoZoom" });

    const classified = classifyShot(makeDraftShot("s2", 0, 8), "product", DEFAULT_MIN_DURATIONS);
    const list: ReadonlyArray<Shot> = [s1, classified];
    expect(publishableShots(list)).toHaveLength(1);
    expect(deleteShot(list, "s1" as ShotId)).toHaveLength(1);
  });
});
