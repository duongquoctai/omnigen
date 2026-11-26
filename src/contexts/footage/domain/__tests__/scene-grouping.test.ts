import { describe, expect, it } from "vitest";

import type { Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";

import { groupScenesIntoShots } from "../scene-grouping";
import { DEFAULT_MIN_DURATIONS } from "../shot";
import type { Scene, TimeRange } from "../types";

const makeScenes = (pairs: ReadonlyArray<readonly [number, number]>): ReadonlyArray<Scene> =>
  pairs.map(([begin, end]) => ({
    range: { begin: begin as Seconds, end: end as Seconds } as TimeRange,
  }));

describe("footage/domain/scene-grouping", () => {
  it("returns empty for empty scenes", () => {
    const res = groupScenesIntoShots({
      scenes: [],
      sourceVideoId: "src_1" as SourceVideoId,
      minDurations: DEFAULT_MIN_DURATIONS,
      makeId: (i) => `s_${String(i)}` as ShotId,
    });
    expect(res).toEqual({ shots: [], slowMoCount: 0 });
  });

  it("groups scenes to meet category min durations and reserves End CTA", () => {
    const scenes = makeScenes([
      [0, 3.0],
      [3.0, 6.0], // open >= 5.8 (0..6.0)
      [6.0, 9.5], // product >= 3.0 (6.0..9.5)
      [9.5, 11.0],
      [11.0, 14.0], // texture >= 4.0 (9.5..14.0)
      [14.0, 16.5],
      [16.5, 19.0], // end >= 4.0 (14.0..19.0)
    ]);

    const res = groupScenesIntoShots({
      scenes,
      sourceVideoId: "src_1" as SourceVideoId,
      minDurations: DEFAULT_MIN_DURATIONS,
      makeId: (i) => `shot_${String(i + 1)}` as ShotId,
    });

    expect(res.shots.map((s) => s.category)).toEqual(["open", "product", "texture", "end"]);
    expect(res.shots.at(0)?.range).toEqual({ begin: 0, end: 6.0 });
    expect(res.shots.at(1)?.range).toEqual({ begin: 6.0, end: 9.5 });
    expect(res.shots.at(2)?.range).toEqual({ begin: 9.5, end: 14.0 });
    expect(res.shots.at(3)?.range).toEqual({ begin: 14.0, end: 19.0 });
    expect(res.slowMoCount).toBe(0);
  });

  it("applies slow-motion when a single scene is shorter than End min duration", () => {
    const scenes = makeScenes([[0, 2.0]]);
    const res = groupScenesIntoShots({
      scenes,
      sourceVideoId: "src_1" as SourceVideoId,
      minDurations: DEFAULT_MIN_DURATIONS,
      makeId: (i) => `shot_${String(i + 1)}` as ShotId,
    });

    expect(res.shots).toHaveLength(1);
    expect(res.shots.at(0)?.category).toBe("end");
    expect(res.shots.at(0)?.edits.speed).toBe(0.5);
    expect(res.slowMoCount).toBe(1);
  });
});
