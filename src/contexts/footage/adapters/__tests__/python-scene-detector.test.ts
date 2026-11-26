import { Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";

import type { LocalPath, MediaUrl, Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";
import { AppConfig } from "@/platform/config";
import { HttpClient, makeHttpClient } from "@/platform/http/client";

import { DEFAULT_MIN_DURATIONS } from "../../domain/shot";
import type { ClassifiedShot, Speed, TimeRange } from "../../domain/types";
import { SceneDetector, ShotSlicer } from "../../workflows/ports";
import { PythonSceneDetectorLive, pythonScenesToDomain } from "../python-scene-detector";
import { PythonShotSlicerLive } from "../python-shot-slicer";
import { shotFromLegacyDto, shotToLegacyDto } from "../shot-dto";

describe("footage/adapters", () => {
  it("maps Python scene DTO to domain Scene and filters zero-length scenes", () => {
    const scenes = pythonScenesToDomain({
      scenes: [
        {
          index: 0,
          start_seconds: 0,
          end_seconds: 3.2,
          duration: 3.2,
          start_frame: 0,
          end_frame: 96,
        },
        {
          index: 1,
          start_seconds: 3.2,
          end_seconds: 3.2,
          duration: 0,
          start_frame: 96,
          end_frame: 96,
        },
      ],
    });
    expect(scenes).toHaveLength(1);
    expect(scenes.at(0)?.range).toEqual({ begin: 0, end: 3.2 });
  });

  it("round-trips LegacyShotDto <-> Shot domain", () => {
    const legacy = {
      id: "shot_1",
      sourceVideoId: "src_1",
      label: "Hook",
      begin: 0,
      end: 4.5,
      rawBegin: 0,
      rawEnd: 4.5,
      category: "open" as const,
      edits: {
        flipH: true,
        lockFlipH: true,
        speed: 1.2,
        zoom: { depth: 1.5 },
        transition: "fade" as const,
        transitionDuration: 0.5,
      },
    };

    const domain = shotFromLegacyDto(legacy);
    expect(domain._tag).toBe("ClassifiedShot");
    expect(shotToLegacyDto(domain)).toEqual(legacy);

    const draft = shotFromLegacyDto({
      ...legacy,
      category: null,
      edits: { ...legacy.edits, zoom: false, transition: null },
    });
    expect(draft._tag).toBe("DraftShot");
    expect(shotToLegacyDto(draft).category).toBeNull();
  });

  it("calls PythonSceneDetectorLive and PythonShotSlicerLive via HttpClient", async () => {
    const fetchMock: typeof fetch = (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/detect-local")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              scenes: [
                {
                  index: 0,
                  start_seconds: 0,
                  end_seconds: 5,
                  duration: 5,
                  start_frame: 0,
                  end_frame: 150,
                },
              ],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            clips: [
              {
                shot_id: "s1",
                category: "open",
                local_path: "/tmp/s1.mp4",
                local_url: "/api/media/s1.mp4",
                duration: 5,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    };

    const BaseLayer = Layer.mergeAll(
      Layer.succeed(AppConfig, {
        nodeEnv: "test",
        authSecret: "test",
        sqliteCloudUrl: Option.none(),
        pythonBackendUrl: "http://127.0.0.1:3006",
        zvidApiKey: Option.none(),
        zvidWebhookSecret: Option.none(),
      }),
      Layer.succeed(HttpClient, makeHttpClient(fetchMock)),
    );

    const AdapterLayer = Layer.mergeAll(
      PythonSceneDetectorLive.pipe(Layer.provide(BaseLayer)),
      PythonShotSlicerLive.pipe(Layer.provide(BaseLayer)),
    );

    const shot: ClassifiedShot = {
      _tag: "ClassifiedShot",
      id: "s1" as ShotId,
      sourceVideoId: "src_1" as SourceVideoId,
      label: "Open #1",
      range: { begin: 0 as Seconds, end: 5 as Seconds } as TimeRange,
      detectedRange: { begin: 0 as Seconds, end: 5 as Seconds } as TimeRange,
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

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const detector = yield* SceneDetector;
        const slicer = yield* ShotSlicer;
        const scenes = yield* detector.detect({
          sourceVideo: {
            id: "src_1" as SourceVideoId,
            name: "v.mp4",
            fileName: "v.mp4",
            localUrl: "/api/media/v.mp4" as MediaUrl,
            localPath: "/tmp/v.mp4" as LocalPath,
            sizeBytes: 100,
            duration: 5 as Seconds,
            width: 1080,
            height: 1920,
            createdAt: "2026-11-17T00:00:00Z",
          },
          detector: "content",
          threshold: 27,
          minSceneLen: 0.8,
        });
        const clips = yield* slicer.slice({
          sessionId: "sess_1",
          sourcePath: "/tmp/v.mp4",
          shots: [shot],
          minDurations: DEFAULT_MIN_DURATIONS,
        });
        return { scenes, clips };
      }).pipe(Effect.provide(AdapterLayer)),
    );

    expect(result.scenes).toHaveLength(1);
    expect(result.clips).toHaveLength(1);
    expect(result.clips.at(0)?.shotId).toBe("s1");
  });
});
