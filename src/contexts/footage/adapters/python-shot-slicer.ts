import { Effect, Layer, Schema } from "effect";

import { AppConfig } from "@/platform/config";
import { HttpClient } from "@/platform/http/client";

import { SlicingFailed } from "../domain/errors";
import { ShotSlicer, type SlicedClipResult } from "../workflows/ports";

const PythonSlicedItemDto = Schema.Struct({
  shot_id: Schema.String,
  category: Schema.String,
  local_path: Schema.String,
  local_url: Schema.String,
  duration: Schema.Number,
});

const PythonSliceResponseDto = Schema.Struct({
  clips: Schema.optional(Schema.Array(PythonSlicedItemDto)),
});

export const PythonShotSlicerLive = Layer.effect(
  ShotSlicer,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const http = yield* HttpClient;

    return {
      slice: (params) => {
        const scenes = params.shots.map((s) => {
          const category = s._tag === "ClassifiedShot" ? s.category : null;
          const minDur = category ? params.minDurations[category] : null;
          return {
            id: s.id,
            begin: s.range.begin,
            end: s.range.end,
            category,
            label: s.label,
            speed: s.edits.speed,
            min_duration: minDur,
            flip_h: s.edits.flip._tag === "Flipped",
            lock_flip_h: s.edits.flip.locked,
          };
        });

        return http
          .fetchJson(
            {
              service: "python",
              url: `${config.pythonBackendUrl}/slice-scenes`,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                file_path: params.sourcePath,
                scenes,
                session_id: params.sessionId,
              }),
              timeoutMs: 180_000,
            },
            PythonSliceResponseDto,
          )
          .pipe(
            Effect.map((res): ReadonlyArray<SlicedClipResult> =>
              (res.clips ?? []).map((c) => ({
                shotId: c.shot_id,
                category: c.category,
                localPath: c.local_path,
                localUrl: c.local_url,
                duration: c.duration,
              })),
            ),
            Effect.mapError((err) => new SlicingFailed({ message: err.message })),
          );
      },
    };
  }),
);
