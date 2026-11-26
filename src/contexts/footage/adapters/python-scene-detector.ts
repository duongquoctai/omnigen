import { Effect, Layer, Schema } from "effect";

import type { Seconds } from "@/contexts/shared-kernel";
import { AppConfig } from "@/platform/config";
import { HttpClient } from "@/platform/http/client";

import { SceneDetectionFailed } from "../domain/errors";
import type { Scene, TimeRange } from "../domain/types";
import { SceneDetector } from "../workflows/ports";

export const PythonSceneItemDto = Schema.Struct({
  index: Schema.Number,
  start_seconds: Schema.Number,
  end_seconds: Schema.Number,
  duration: Schema.Number,
  start_frame: Schema.Number,
  end_frame: Schema.Number,
});

export const PythonDetectResponseDto = Schema.Struct({
  scenes: Schema.Array(PythonSceneItemDto),
});

export const pythonScenesToDomain = (
  dto: typeof PythonDetectResponseDto.Type,
): ReadonlyArray<Scene> =>
  dto.scenes
    .filter((item) => item.end_seconds > item.start_seconds)
    .map((item) => ({
      range: {
        begin: Math.max(0, item.start_seconds) as Seconds,
        end: Math.max(0, item.end_seconds) as Seconds,
      } as TimeRange,
    }));

export const PythonSceneDetectorLive = Layer.effect(
  SceneDetector,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const http = yield* HttpClient;

    return {
      detect: (params) =>
        http
          .fetchJson(
            {
              service: "python",
              url: `${config.pythonBackendUrl}/detect-local`,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                file_path: params.sourceVideo.localPath,
                detector: params.detector,
                threshold: params.threshold,
                min_scene_len: params.minSceneLen,
              }),
              timeoutMs: 120_000,
            },
            PythonDetectResponseDto,
          )
          .pipe(
            Effect.map(pythonScenesToDomain),
            Effect.mapError(
              (err) =>
                new SceneDetectionFailed({
                  message: err.message,
                }),
            ),
          ),
    };
  }),
);
