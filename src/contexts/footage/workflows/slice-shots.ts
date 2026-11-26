import { Effect, Schema } from "effect";

import { SlicingFailed } from "../domain/errors";
import { DEFAULT_MIN_DURATIONS } from "../domain/shot";
import { CategoryMinDurations, Shot } from "../domain/types";
import { FootageRepo, ShotSlicer } from "./ports";

export const SliceShotsInput = Schema.Struct({
  sessionId: Schema.NonEmptyString,
  shots: Schema.NonEmptyArray(Shot),
  minDurations: Schema.optional(CategoryMinDurations),
});
export type SliceShotsInput = typeof SliceShotsInput.Type;

export const sliceShots = (input: SliceShotsInput) =>
  Effect.gen(function* () {
    const repo = yield* FootageRepo;
    const slicer = yield* ShotSlicer;

    const sourceVideo = yield* repo.getSourceVideo(input.sessionId);
    if (input.shots.length === 0) {
      return yield* Effect.fail(new SlicingFailed({ message: "Danh sách cảnh cắt rỗng." }));
    }

    return yield* slicer.slice({
      sessionId: input.sessionId,
      sourcePath: sourceVideo.localPath,
      shots: input.shots,
      minDurations: input.minDurations ?? DEFAULT_MIN_DURATIONS,
    });
  });
