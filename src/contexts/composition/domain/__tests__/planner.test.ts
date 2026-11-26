import { Option, Result } from "effect";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type {
  ClipId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
  VoiceId,
} from "@/contexts/shared-kernel";

import { extractGoogleDriveFileId, parseExcelFiveColumnClipboard } from "../drive-parser";
import {
  assignVoicesToTuples,
  buildPlannedVideo,
  computeFingerprintHamming,
  ensureCompleteLibrary,
  getClipFingerprint,
  planDiverseTuples,
  recalculatePlannedVideo,
  tupleToKey,
} from "../planner";
import type {
  Clip,
  ClipLibrary,
  DiversityRules,
  DriveFileId,
  HammingDistance,
  MaxShotFrequency,
  PlannedVideoId,
  TargetCount,
  VoiceClip,
} from "../types";

const makeClip = (id: string, category: ShotCategory, duration = 4): Clip => ({
  id: id as ClipId,
  name: `Clip ${id}`,
  fileName: `${id}.mp4`,
  category,
  duration: duration as Seconds,
  source: {
    _tag: "LocalClip",
    localPath: `/tmp/${id}.mp4` as LocalPath,
    localUrl: `/api/media/${id}.mp4` as MediaUrl,
  },
  lockFlipH: false,
  contentHash: Option.none(),
});

const makeLibrary = (perCategory: number): ClipLibrary => {
  const cats = (cat: ShotCategory) =>
    Array.from({ length: perCategory }, (_, i) => makeClip(`${cat}_${String(i + 1)}`, cat));
  return {
    open: cats("open"),
    product: cats("product"),
    texture: cats("texture"),
    apply: cats("apply"),
    end: cats("end"),
  };
};

const makeRules = (overrides: Partial<DiversityRules> = {}): DiversityRules => ({
  targetCount: 5 as TargetCount,
  targetOutputDuration: 20 as Seconds,
  minHammingDistance: 2 as HammingDistance,
  maxShotFrequency: 3 as MaxShotFrequency,
  enableAutoVariantEdits: false,
  randomTransitionDuration: 0 as Seconds,
  seed: 42,
  ...overrides,
});

describe("composition/domain/planner", () => {
  it("fails with LibraryIncomplete when any category is empty", () => {
    const lib = { ...makeLibrary(2), texture: [] };
    const res = ensureCompleteLibrary(lib);
    expect(Result.isFailure(res)).toBe(true);
    if (Result.isFailure(res)) {
      expect(res.failure.missingCategories).toEqual(["texture"]);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const lib = makeLibrary(3);
    const rules = makeRules({ targetCount: 6 as TargetCount, seed: 1234 });
    const run1 = planDiverseTuples(lib, rules);
    const run2 = planDiverseTuples(lib, rules);

    expect(Result.isSuccess(run1)).toBe(true);
    expect(Result.isSuccess(run2)).toBe(true);
    if (Result.isSuccess(run1) && Result.isSuccess(run2)) {
      const keys1 = run1.success.tuples.map((t) => t.map((c) => c.id).join("|"));
      const keys2 = run2.success.tuples.map((t) => t.map((c) => c.id).join("|"));
      expect(keys1).toEqual(keys2);
      expect(run1.success.minPairwiseHamming).toBeGreaterThanOrEqual(2);
    }
  });

  it("avoids collisions with previously rendered history tuples", () => {
    const lib = makeLibrary(2);
    const history = ["open_1|product_1|texture_1|apply_1|end_1"];
    const res = planDiverseTuples(
      lib,
      makeRules({ targetCount: 4 as TargetCount, minHammingDistance: 2 as HammingDistance }),
      history,
    );
    expect(Result.isSuccess(res)).toBe(true);
    if (Result.isSuccess(res)) {
      res.success.tuples.forEach((t) => {
        const fps = t.map(getClipFingerprint) as unknown as readonly [
          string,
          string,
          string,
          string,
          string,
        ];
        expect(
          computeFingerprintHamming(fps, ["open_1", "product_1", "texture_1", "apply_1", "end_1"]),
        ).toBeGreaterThanOrEqual(2);
      });
    }
  });

  it("property: all generated pairs obey minHammingDistance", () => {
    const lib = makeLibrary(4);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 2, max: 3 }),
        (seed, minHamming) => {
          const res = planDiverseTuples(
            lib,
            makeRules({
              seed,
              targetCount: 5 as TargetCount,
              minHammingDistance: minHamming as HammingDistance,
              maxShotFrequency: 5 as MaxShotFrequency,
            }),
          );
          if (Result.isFailure(res)) return false;
          if (res.success.tuples.length > 1) {
            expect(res.success.minPairwiseHamming).toBeGreaterThanOrEqual(minHamming);
          }
          return true;
        },
      ),
    );
  });

  it("builds PlannedVideo across voice_master, video_master, and shorter_wins", () => {
    const clips = [
      makeClip("open_1", "open"),
      makeClip("product_1", "product"),
      makeClip("texture_1", "texture"),
      makeClip("apply_1", "apply"),
      makeClip("end_1", "end"),
    ] as const;
    const voice: VoiceClip = {
      id: "v1" as VoiceId,
      name: "Voice 1",
      fileName: "v1.mp3",
      localUrl: "/api/media/v1.mp3" as MediaUrl,
      localPath: Option.none(),
      duration: 15 as Seconds,
    };

    const vm = buildPlannedVideo({
      id: "pv_1" as PlannedVideoId,
      name: "Mix 1",
      clips,
      voice: Option.some(voice),
      syncMode: "video_master",
      targetOutputDuration: 20,
    });
    expect(vm.finalDuration).toBe(20);
    expect(tupleToKey(vm.tuple)).toBe("open_1|product_1|texture_1|apply_1|end_1");

    const voiceMaster = buildPlannedVideo({
      id: "pv_2" as PlannedVideoId,
      name: "Mix 2",
      clips,
      voice: Option.some(voice),
      syncMode: "voice_master",
      targetOutputDuration: 20,
    });
    expect(voiceMaster.finalDuration).toBe(15);

    const shorter = buildPlannedVideo({
      id: "pv_3" as PlannedVideoId,
      name: "Mix 3",
      clips,
      voice: Option.some(voice),
      syncMode: "shorter_wins",
      targetOutputDuration: 20,
    });
    expect(shorter.finalDuration).toBe(15);

    const preserved = buildPlannedVideo({
      id: "pv_4" as PlannedVideoId,
      name: "Mix 4",
      clips: [
        makeClip("open_1", "open", 5.0),
        makeClip("product_1", "product", 3.1),
        makeClip("texture_1", "texture", 4.0),
        makeClip("apply_1", "apply", 4.2),
        makeClip("end_1", "end", 4.0),
      ],
      voice: Option.some(voice),
      syncMode: "video_master",
      targetOutputDuration: 20,
      preserveOriginalClips: true,
    });
    expect(preserved.finalDuration).toBe(20.3);
    expect(preserved.slots[0].speed).toBe(1);
    expect(preserved.slots[0].originalVideoEnd).toBe(5);
    expect(preserved.tupleKey).toBe("open_1|product_1|texture_1|apply_1|end_1");

    const edited = recalculatePlannedVideo({
      video: preserved,
      slotIndex: 0,
      edits: { videoBegin: 1, videoEnd: 4, speed: 1.5, flipH: true },
    });
    expect(edited.slots[0].flipH).toBe(true);
    expect(edited.slots[0].exitEnd).toBe(2);
    expect(edited.finalDuration).toBe(17.3);

    const assigned = assignVoicesToTuples(
      [clips, clips],
      [voice, { ...voice, id: "v2" as VoiceId, name: "Voice 2" }],
      true,
    );
    expect(assigned).toHaveLength(2);
    expect(Option.getOrNull(assigned[0] ?? Option.none())?.id).toBe("v1");
    expect(Option.getOrNull(assigned[1] ?? Option.none())?.id).toBe("v2");
  });

  it("extracts Google Drive IDs and parses 5-column Excel clipboard", () => {
    const id = extractGoogleDriveFileId(
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing",
    );
    expect(Option.getOrNull(id)).toBe("1AbCdEfGhIjKlMnOpQrStUvWxYz");
    expect(Option.isNone(extractGoogleDriveFileId("not-a-drive-id"))).toBe(true);

    const clip: Clip = {
      ...makeClip("c1", "open"),
      source: {
        _tag: "DriveClip",
        fileId: "1AbCdEfGhIjKlMnOpQrStUvWxYz" as DriveFileId,
        streamUrl: "/api/drive-stream/1AbCdEfGhIjKlMnOpQrStUvWxYz" as MediaUrl,
      },
    };
    expect(getClipFingerprint(clip)).toBe("gdrive:1AbCdEfGhIjKlMnOpQrStUvWxYz");

    const parsed = parseExcelFiveColumnClipboard(
      "1AbCdEfGhIjKlMnOpQrStUvWxYz1\t1AbCdEfGhIjKlMnOpQrStUvWxYz2\t\t1AbCdEfGhIjKlMnOpQrStUvWxYz4\t1AbCdEfGhIjKlMnOpQrStUvWxYz5",
    );
    expect(parsed.open).toHaveLength(1);
    expect(parsed.texture).toHaveLength(0);
    expect(parsed.end).toHaveLength(1);
  });
});
