import { Effect, Schema } from "effect";

import { SceneDetectionFailed } from "../domain/errors";
import { groupScenesIntoShots } from "../domain/scene-grouping";
import { DEFAULT_MIN_DURATIONS } from "../domain/shot";
import { CategoryMinDurations, type ClassifiedShot } from "../domain/types";
import { FootageRepo, SceneDetector, ShotIdGenerator } from "./ports";

export const DetectScenesInput = Schema.Struct({
  sessionId: Schema.NonEmptyString,
  detector: Schema.Literals(["content", "adaptive"]),
  threshold: Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
  minSceneLen: Schema.Number.check(Schema.isBetween({ minimum: 0.1, maximum: 30 })),
  minDurations: Schema.optional(CategoryMinDurations),
});
export type DetectScenesInput = typeof DetectScenesInput.Type;

export interface DetectScenesOutput {
  readonly totalScenes: number;
  readonly totalDetected: number;
  readonly slowMoCount: number;
  readonly shots: ReadonlyArray<ClassifiedShot>;
}

export const detectScenes = (input: DetectScenesInput) =>
  Effect.gen(function* () {
    const repo = yield* FootageRepo;
    const detector = yield* SceneDetector;
    const idGen = yield* ShotIdGenerator;

    const sourceVideo = yield* repo.getSourceVideo(input.sessionId);
    const scenes = yield* detector.detect({
      sourceVideo,
      detector: input.detector,
      threshold: input.threshold,
      minSceneLen: input.minSceneLen,
    });

    if (scenes.length === 0) {
      return yield* Effect.fail(
        new SceneDetectionFailed({
          message: "PySceneDetect không tìm thấy phân cảnh nào.",
        }),
      );
    }

    const minDurations = input.minDurations ?? DEFAULT_MIN_DURATIONS;
    const grouped = groupScenesIntoShots({
      scenes,
      sourceVideoId: sourceVideo.id,
      minDurations,
      makeId: (index) => idGen.makeId(input.sessionId, index),
    });

    yield* repo.saveShots(input.sessionId, grouped.shots, minDurations);

    return {
      totalScenes: scenes.length,
      totalDetected: grouped.shots.length,
      slowMoCount: grouped.slowMoCount,
      shots: grouped.shots,
    } satisfies DetectScenesOutput;
  });
