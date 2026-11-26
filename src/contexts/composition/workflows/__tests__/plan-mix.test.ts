import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import type {
  ClipId,
  FolderId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
} from "@/contexts/shared-kernel";

import { LibraryIncomplete } from "../../domain/errors";
import type {
  Clip,
  ClipLibrary,
  HammingDistance,
  MaxShotFrequency,
  TargetCount,
} from "../../domain/types";
import { onShotsPublished } from "../on-shots-published";
import { planMix } from "../plan-mix";
import { ClipLibraryRepo, PlannedVideoRepo, RenderedTuplesQuery, VoiceLibraryRepo } from "../ports";

const makeClip = (id: string, category: ShotCategory): Clip => ({
  id: id as ClipId,
  name: id,
  fileName: `${id}.mp4`,
  category,
  duration: 4 as Seconds,
  source: {
    _tag: "LocalClip",
    localPath: `/tmp/${id}.mp4` as LocalPath,
    localUrl: `/api/media/${id}.mp4` as MediaUrl,
  },
  lockFlipH: false,
  contentHash: Option.none(),
});

const fullLibrary: ClipLibrary = {
  open: [makeClip("o1", "open"), makeClip("o2", "open")],
  product: [makeClip("p1", "product"), makeClip("p2", "product")],
  texture: [makeClip("t1", "texture"), makeClip("t2", "texture")],
  apply: [makeClip("a1", "apply"), makeClip("a2", "apply")],
  end: [makeClip("e1", "end"), makeClip("e2", "end")],
};

describe("composition/workflows", () => {
  it.effect("plans diverse mix and persists PlannedVideos", () => {
    let persistedCount = 0;
    const TestLayer = Layer.mergeAll(
      Layer.succeed(ClipLibraryRepo, {
        get: () => Effect.succeed(fullLibrary),
        addClips: () => Effect.void,
        removeClip: () => Effect.void,
        clearCategory: () => Effect.void,
      }),
      Layer.succeed(VoiceLibraryRepo, {
        list: () => Effect.succeed([]),
        addVoices: () => Effect.void,
        removeVoice: () => Effect.void,
      }),
      Layer.succeed(RenderedTuplesQuery, {
        forFolder: () => Effect.succeed([]),
      }),
      Layer.succeed(PlannedVideoRepo, {
        replaceAll: (_fid, videos) => {
          persistedCount = videos.length;
          return Effect.void;
        },
      }),
    );

    return planMix({
      folderId: "fld_1" as FolderId,
      rules: {
        targetCount: 3 as TargetCount,
        targetOutputDuration: 20 as Seconds,
        minHammingDistance: 2 as HammingDistance,
        maxShotFrequency: 3 as MaxShotFrequency,
        enableAutoVariantEdits: false,
        randomTransitionDuration: 0 as Seconds,
        seed: 42,
      },
      syncMode: "video_master",
    }).pipe(
      Effect.provide(TestLayer),
      Effect.map((event) => {
        expect(event._tag).toBe("MixPlanned");
        expect(event.videos).toHaveLength(3);
        expect(persistedCount).toBe(3);
      }),
    );
  });

  it.effect("fails with LibraryIncomplete when category pool is empty", () => {
    const EmptyLayer = Layer.mergeAll(
      Layer.succeed(ClipLibraryRepo, {
        get: () => Effect.succeed({ ...fullLibrary, open: [] }),
        addClips: () => Effect.void,
        removeClip: () => Effect.void,
        clearCategory: () => Effect.void,
      }),
      Layer.succeed(VoiceLibraryRepo, {
        list: () => Effect.succeed([]),
        addVoices: () => Effect.void,
        removeVoice: () => Effect.void,
      }),
      Layer.succeed(RenderedTuplesQuery, { forFolder: () => Effect.succeed([]) }),
      Layer.succeed(PlannedVideoRepo, { replaceAll: () => Effect.void }),
    );

    return planMix({
      folderId: "fld_1" as FolderId,
      rules: {
        targetCount: 2 as TargetCount,
        targetOutputDuration: 20 as Seconds,
        minHammingDistance: 2 as HammingDistance,
        maxShotFrequency: 2 as MaxShotFrequency,
        enableAutoVariantEdits: false,
        randomTransitionDuration: 0 as Seconds,
        seed: 42,
      },
      syncMode: "video_master",
    }).pipe(
      Effect.provide(EmptyLayer),
      Effect.flip,
      Effect.map((err) => {
        expect(err).toBeInstanceOf(LibraryIncomplete);
      }),
    );
  });

  it.effect("handles ShotsPublished event by adding FromShotClips to library", () => {
    let addedCount = 0;
    const RepoLayer = Layer.succeed(ClipLibraryRepo, {
      get: () => Effect.succeed(fullLibrary),
      addClips: (_fid, clips) => {
        addedCount = clips.length;
        return Effect.void;
      },
      removeClip: () => Effect.void,
      clearCategory: () => Effect.void,
    });

    return onShotsPublished({
      folderId: "fld_1" as FolderId,
      shots: [
        {
          shotId: "s1",
          name: "Open #1",
          fileName: "s1.mp4",
          category: "open",
          duration: 5.8 as Seconds,
          localPath: "/tmp/s1.mp4" as LocalPath,
          localUrl: "/api/media/s1.mp4" as MediaUrl,
          lockFlipH: true,
          contentHash: Option.none(),
        },
      ],
    }).pipe(
      Effect.provide(RepoLayer),
      Effect.map((event) => {
        expect(event._tag).toBe("ClipsAdded");
        expect(addedCount).toBe(1);
        expect(event.clips.at(0)?.source._tag).toBe("FromShotClip");
      }),
    );
  });
});
