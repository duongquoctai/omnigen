import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import type {
  FolderId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotId,
  SourceVideoId,
} from "@/contexts/shared-kernel";

import { UnclassifiedShotError } from "../../domain/errors";
import type { ClassifiedShot, DraftShot, Speed, TimeRange } from "../../domain/types";
import { FootageRepo, ShotSlicer } from "../ports";
import { publishShotsToLibrary } from "../publish-shots";

const fakeSource = {
  id: "src_1" as SourceVideoId,
  name: "review.mp4",
  fileName: "review.mp4",
  localUrl: "/api/media/sessions/s1/source/review.mp4" as MediaUrl,
  localPath: "/tmp/s1/source/review.mp4" as LocalPath,
  sizeBytes: 1024,
  duration: 10 as Seconds,
  width: 1080,
  height: 1920,
  createdAt: "2026-11-17T00:00:00Z",
};

const classifiedShot: ClassifiedShot = {
  _tag: "ClassifiedShot",
  id: "s1" as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label: "Open #1",
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

const draftShot: DraftShot = {
  _tag: "DraftShot",
  id: "s2" as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label: "Nháp",
  range: { begin: 5.8 as Seconds, end: 9 as Seconds } as TimeRange,
  detectedRange: { begin: 5.8 as Seconds, end: 9 as Seconds } as TimeRange,
  contentHash: Option.none(),
  edits: classifiedShot.edits,
};

describe("footage/workflows/publish-shots", () => {
  it.effect("rejects DraftShot with UnclassifiedShotError", () => {
    const TestLayer = Layer.mergeAll(
      Layer.succeed(FootageRepo, {
        getSourceVideo: () => Effect.succeed(fakeSource),
        saveShots: () => Effect.void,
      }),
      Layer.succeed(ShotSlicer, {
        slice: () => Effect.succeed([]),
      }),
    );

    return publishShotsToLibrary({
      sessionId: "s1",
      folderId: "fld_1" as FolderId,
      shots: [draftShot],
    }).pipe(
      Effect.provide(TestLayer),
      Effect.flip,
      Effect.map((err) => {
        expect(err).toBeInstanceOf(UnclassifiedShotError);
      }),
    );
  });

  it.effect("slices classified shots and emits ShotsPublished event", () => {
    const TestLayer = Layer.mergeAll(
      Layer.succeed(FootageRepo, {
        getSourceVideo: () => Effect.succeed(fakeSource),
        saveShots: () => Effect.void,
      }),
      Layer.succeed(ShotSlicer, {
        slice: () =>
          Effect.succeed([
            {
              shotId: "s1",
              category: "open",
              localPath: "/tmp/s1/slices/s1.mp4",
              localUrl: "/api/media/sessions/s1/slices/s1.mp4",
              duration: 5.8,
            },
          ]),
      }),
    );

    return publishShotsToLibrary({
      sessionId: "s1",
      folderId: "fld_1" as FolderId,
      shots: [classifiedShot],
    }).pipe(
      Effect.provide(TestLayer),
      Effect.map((event) => {
        expect(event._tag).toBe("ShotsPublished");
        expect(event.folderId).toBe("fld_1");
        expect(event.shots).toHaveLength(1);
        expect(event.shots[0].category).toBe("open");
      }),
    );
  });
});
