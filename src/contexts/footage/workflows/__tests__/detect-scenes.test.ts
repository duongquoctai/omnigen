import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import type { LocalPath, MediaUrl, Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";

import { SceneDetectionFailed } from "../../domain/errors";
import type { Scene, SourceVideo, TimeRange } from "../../domain/types";
import { detectScenes } from "../detect-scenes";
import { FootageRepo, SceneDetector, ShotIdGenerator } from "../ports";

const fakeSource: SourceVideo = {
  id: "src_1" as SourceVideoId,
  name: "review.mp4",
  fileName: "review.mp4",
  localUrl: "/api/media/sessions/s1/source/review.mp4" as MediaUrl,
  localPath: "/tmp/s1/source/review.mp4" as LocalPath,
  sizeBytes: 1024,
  duration: 15 as Seconds,
  width: 1080,
  height: 1920,
  createdAt: "2026-11-17T00:00:00Z",
};

const fakeScenes: ReadonlyArray<Scene> = [
  { range: { begin: 0 as Seconds, end: 6 as Seconds } as TimeRange },
  { range: { begin: 6 as Seconds, end: 10 as Seconds } as TimeRange },
  { range: { begin: 10 as Seconds, end: 15 as Seconds } as TimeRange },
];

describe("footage/workflows/detect-scenes", () => {
  it.effect("groups detected scenes and persists shots", () => {
    let savedCount = 0;
    const TestLayer = Layer.mergeAll(
      Layer.succeed(FootageRepo, {
        getSourceVideo: () => Effect.succeed(fakeSource),
        saveShots: (_sid, shots) => {
          savedCount = shots.length;
          return Effect.void;
        },
      }),
      Layer.succeed(SceneDetector, {
        detect: () => Effect.succeed(fakeScenes),
      }),
      Layer.succeed(ShotIdGenerator, {
        makeId: (_fid, i) => `shot_${String(i + 1)}` as ShotId,
      }),
    );

    return detectScenes({
      sessionId: "s1",
      detector: "content",
      threshold: 27,
      minSceneLen: 0.8,
    }).pipe(
      Effect.provide(TestLayer),
      Effect.map((result) => {
        expect(result.totalScenes).toBe(3);
        expect(result.totalDetected).toBe(3);
        expect(savedCount).toBe(3);
      }),
    );
  });

  it.effect("fails with SceneDetectionFailed when no scenes found", () => {
    const EmptyLayer = Layer.mergeAll(
      Layer.succeed(FootageRepo, {
        getSourceVideo: () => Effect.succeed(fakeSource),
        saveShots: () => Effect.void,
      }),
      Layer.succeed(SceneDetector, {
        detect: () => Effect.succeed([]),
      }),
      Layer.succeed(ShotIdGenerator, {
        makeId: (_fid, i) => `shot_${String(i + 1)}` as ShotId,
      }),
    );

    return detectScenes({
      sessionId: "s1",
      detector: "content",
      threshold: 27,
      minSceneLen: 0.8,
    }).pipe(
      Effect.provide(EmptyLayer),
      Effect.flip,
      Effect.map((err) => {
        expect(err).toBeInstanceOf(SceneDetectionFailed);
      }),
    );
  });
});
