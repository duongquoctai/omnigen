import { Option } from "effect";
import { describe, expect, it } from "vitest";

import type { Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";

import type { DraftShot, Speed, TimeRange } from "../../domain/types";
import { createInitialFootageState, footageReducer } from "../footage-reducer";

const makeShot = (id: string, begin: number, end: number): DraftShot => ({
  _tag: "DraftShot",
  id: id as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label: `Cảnh ${id}`,
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

describe("footage/ui/footage-reducer", () => {
  it("handles classify, split, merge, flip, speed, zoom, and delete", () => {
    const s1 = makeShot("s1", 0, 10);
    let state = createInitialFootageState([s1], 20);

    state = footageReducer(state, {
      _tag: "ClassifyShot",
      shotId: "s1" as ShotId,
      category: "open",
    });
    expect(state.shots.at(0)?._tag).toBe("ClassifiedShot");

    state = footageReducer(state, {
      _tag: "SplitShot",
      shotId: "s1" as ShotId,
      targetSec: 4,
      newSecondId: "s2" as ShotId,
    });
    expect(state.shots).toHaveLength(2);
    expect(state.selectedShotId).toBe("s2");

    state = footageReducer(state, { _tag: "ToggleFlip", shotId: "s1" as ShotId });
    expect(state.shots.at(0)?.edits.flip._tag).toBe("Flipped");

    state = footageReducer(state, { _tag: "MergeWithNext", shotId: "s1" as ShotId });
    expect(state.shots).toHaveLength(1);

    state = footageReducer(state, { _tag: "DeleteShot", shotId: "s1" as ShotId });
    expect(state.shots).toHaveLength(0);
    expect(state.selectedShotId).toBeNull();
  });

  it("sets errorMessage on invalid split and clears on ClearError", () => {
    const tiny = makeShot("s1", 0, 0.3);
    let state = createInitialFootageState([tiny], 10);
    state = footageReducer(state, {
      _tag: "SplitShot",
      shotId: "s1" as ShotId,
      targetSec: 0.15,
      newSecondId: "s2" as ShotId,
    });
    expect(state.errorMessage).toBeTruthy();

    state = footageReducer(state, { _tag: "ClearError" });
    expect(state.errorMessage).toBeNull();
  });

  it("handles SetMinDuration, RenameShot, AddManualShot, ToggleFlipLock, SetSpeed, and ResetSession", () => {
    const s1 = makeShot("s1", 0, 2);
    let state = createInitialFootageState([s1], 30);

    state = footageReducer(state, {
      _tag: "ClassifyShot",
      shotId: "s1" as ShotId,
      category: "open",
    });
    state = footageReducer(state, {
      _tag: "SetMinDuration",
      category: "open",
      seconds: 8,
    });
    expect(state.minDurations.open).toBe(8);
    expect(state.shots.at(0)?.edits.speed).toBe(0.25);

    state = footageReducer(state, {
      _tag: "RenameShot",
      shotId: "s1" as ShotId,
      label: "Hook mới",
    });
    expect(state.shots.at(0)?.label).toBe("Hook mới");

    state = footageReducer(state, { _tag: "ToggleFlipLock", shotId: "s1" as ShotId });
    expect(state.shots.at(0)?.edits.flip.locked).toBe(true);

    state = footageReducer(state, {
      _tag: "SetSpeed",
      shotId: "s1" as ShotId,
      speed: 1.5 as Speed,
    });
    expect(state.shots.at(0)?.edits.speed).toBe(1.5);

    const s2 = makeShot("s2", 2, 5);
    state = footageReducer(state, { _tag: "AddManualShot", shot: s2 });
    expect(state.shots).toHaveLength(2);
    expect(state.selectedShotId).toBe("s2");

    state = footageReducer(state, { _tag: "ResetSession" });
    expect(state.shots).toHaveLength(0);
    expect(state.selectedShotId).toBeNull();
  });
});
