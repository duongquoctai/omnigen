import { Effect, Option, Schema } from "effect";

import {
  FolderId,
  type LocalPath,
  type MediaUrl,
  type Seconds,
  type ShotId,
} from "@/contexts/shared-kernel";

import { SlicingFailed, UnclassifiedShotError } from "../domain/errors";
import { type PublishedShot, type ShotsPublished } from "../domain/events";
import { DEFAULT_MIN_DURATIONS } from "../domain/shot";
import { CategoryMinDurations, Shot } from "../domain/types";
import { FootageRepo, ShotSlicer } from "./ports";

export const PublishShotsInput = Schema.Struct({
  sessionId: Schema.NonEmptyString,
  folderId: FolderId,
  shots: Schema.NonEmptyArray(Shot),
  minDurations: Schema.optional(CategoryMinDurations),
});
export type PublishShotsInput = typeof PublishShotsInput.Type;

export const publishShotsToLibrary = (input: PublishShotsInput) =>
  Effect.gen(function* () {
    const firstDraft = input.shots.find((s) => s._tag === "DraftShot");
    if (firstDraft) {
      return yield* Effect.fail(
        new UnclassifiedShotError({
          shotId: firstDraft.id,
          message: `Cảnh "${firstDraft.label}" chưa được phân loại category.`,
        }),
      );
    }

    const repo = yield* FootageRepo;
    const slicer = yield* ShotSlicer;
    const sourceVideo = yield* repo.getSourceVideo(input.sessionId);

    const sliced = yield* slicer.slice({
      sessionId: input.sessionId,
      sourcePath: sourceVideo.localPath,
      shots: input.shots,
      minDurations: input.minDurations ?? DEFAULT_MIN_DURATIONS,
    });

    if (sliced.length === 0) {
      return yield* Effect.fail(
        new SlicingFailed({ message: "Không tạo được clip nào sau khi cắt." }),
      );
    }

    const publishedShots: ReadonlyArray<PublishedShot> = sliced.map((clip) => {
      const matched = input.shots.find((s) => s.id === clip.shotId);
      const category = matched?._tag === "ClassifiedShot" ? matched.category : "open";
      const fileName = `${clip.shotId}.mp4`;
      return {
        shotId: clip.shotId as ShotId,
        name: matched?.label ?? fileName,
        fileName,
        category,
        duration: Math.max(0.1, clip.duration) as Seconds,
        localPath: clip.localPath as LocalPath,
        localUrl: clip.localUrl as MediaUrl,
        lockFlipH: matched?.edits.flip.locked ?? false,
        contentHash: matched ? matched.contentHash : Option.none(),
      };
    });

    const first = publishedShots.at(0);
    if (!first) {
      return yield* Effect.fail(new SlicingFailed({ message: "Danh sách clip xuất rỗng." }));
    }

    return {
      _tag: "ShotsPublished",
      folderId: input.folderId,
      shots: [first, ...publishedShots.slice(1)],
    } satisfies ShotsPublished;
  });
