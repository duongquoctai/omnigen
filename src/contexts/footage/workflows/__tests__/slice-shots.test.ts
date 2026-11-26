import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import type { LocalPath, MediaUrl, Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";

import { SlicingFailed } from "../../domain/errors";
import type { DraftShot, Speed, TimeRange } from "../../domain/types";
import { FootageRepo, ShotSlicer } from "../ports";
import { sliceShots } from "../slice-shots";

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

const sampleShot: DraftShot = {
  _tag: "DraftShot",
  id: "s1" as ShotId,
  sourceVideoId: "src_1" as SourceVideoId,
  label: "Scene 1",
  range: { begin: 0 as Seconds, end: 4 as Seconds } as TimeRange,
  detectedRange: { begin: 0 as Seconds, end: 4 as Seconds } as TimeRange,
  contentHash: Option.none(),
  edits: {
    flip: { _tag: "Unflipped", locked: false },
    speed: 1 as Speed,
    zoom: { _tag: "NoZoom" },
    crop: Option.none(),
    transition: { _tag: "NoTransition" },
  },
};

describe("footage/workflows/slice-shots", () => {
  it.effect("slices shots via ShotSlicer port", () => {
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
              duration: 4,
            },
          ]),
      }),
    );

    return sliceShots({ sessionId: "s1", shots: [sampleShot] }).pipe(
      Effect.provide(TestLayer),
      Effect.map((res) => {
        expect(res).toHaveLength(1);
        expect(res.at(0)?.shotId).toBe("s1");
      }),
    );
  });

  it.effect("propagates SlicingFailed from ShotSlicer", () => {
    const FailLayer = Layer.mergeAll(
      Layer.succeed(FootageRepo, {
        getSourceVideo: () => Effect.succeed(fakeSource),
        saveShots: () => Effect.void,
      }),
      Layer.succeed(ShotSlicer, {
        slice: () => Effect.fail(new SlicingFailed({ message: "FFmpeg error" })),
      }),
    );

    return sliceShots({ sessionId: "s1", shots: [sampleShot] }).pipe(
      Effect.provide(FailLayer),
      Effect.flip,
      Effect.map((err) => {
        expect(err).toBeInstanceOf(SlicingFailed);
      }),
    );
  });
});
