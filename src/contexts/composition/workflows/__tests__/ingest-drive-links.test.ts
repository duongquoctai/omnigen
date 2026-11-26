import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { ClipId, FolderId, MediaUrl, Seconds, VoiceId } from "@/contexts/shared-kernel";

import type { Clip, ClipLibrary, DriveFileId, VoiceClip } from "../../domain/types";
import {
  clearCategoryPool,
  ingestDriveLinks,
  ingestDriveVoices,
  removeClipFromLibrary,
  removeVoiceTrack,
} from "../ingest-drive-links";
import { ClipLibraryRepo, DriveMediaGateway, VoiceLibraryRepo } from "../ports";

const emptyLibrary: ClipLibrary = {
  open: [],
  product: [],
  texture: [],
  apply: [],
  end: [],
};

describe("composition/workflows/ingest-drive-links", () => {
  it.effect("ingests valid drive links and voices, and supports clip/voice removal", () => {
    const savedClips: Array<Clip> = [];
    const savedVoices: Array<VoiceClip> = [];

    const TestLayer = Layer.mergeAll(
      Layer.succeed(DriveMediaGateway, {
        probeClip: (fileId: DriveFileId) =>
          Effect.succeed({
            fileId,
            name: `Clip ${fileId.slice(0, 6)}`,
            duration: 4 as Seconds,
            streamUrl: `/api/drive-stream/${fileId}` as MediaUrl,
            lockFlipH: false,
            contentHash: Option.none(),
          }),
        probeVoice: (fileId: DriveFileId) =>
          Effect.succeed({
            fileId,
            name: `Voice ${fileId.slice(0, 6)}`,
            duration: 12 as Seconds,
            streamUrl: `/api/drive-stream/${fileId}` as MediaUrl,
            lockFlipH: false,
            contentHash: Option.none(),
          }),
      }),
      Layer.succeed(ClipLibraryRepo, {
        get: () => Effect.succeed(emptyLibrary),
        addClips: (_fid, clips) => {
          savedClips.push(...clips);
          return Effect.void;
        },
        removeClip: () => Effect.void,
        clearCategory: () => Effect.void,
      }),
      Layer.succeed(VoiceLibraryRepo, {
        list: () => Effect.succeed([]),
        addVoices: (_fid, voices) => {
          savedVoices.push(...voices);
          return Effect.void;
        },
        removeVoice: () => Effect.void,
      }),
    );

    const folderId = "fld_1" as FolderId;
    const sampleId = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345";

    return Effect.gen(function* () {
      const clipRes = yield* ingestDriveLinks({
        folderId,
        category: "open",
        urls: [
          `https://drive.google.com/file/d/${sampleId}/view`,
          "https://example.com/not-a-drive-link",
        ],
      });
      expect(clipRes.addedCount).toBe(1);
      expect(clipRes.skippedUrls).toEqual(["https://example.com/not-a-drive-link"]);
      expect(savedClips).toHaveLength(1);

      const voiceRes = yield* ingestDriveVoices({
        folderId,
        urls: [`https://drive.google.com/open?id=${sampleId}`],
      });
      expect(voiceRes.addedCount).toBe(1);
      expect(savedVoices).toHaveLength(1);

      const removedClip = yield* removeClipFromLibrary({
        folderId,
        clipId: `drv_${sampleId}` as ClipId,
      });
      expect(removedClip.clipId).toBe(`drv_${sampleId}`);

      const cleared = yield* clearCategoryPool({ folderId, category: "open" });
      expect(cleared.category).toBe("open");

      const removedVoice = yield* removeVoiceTrack({
        folderId,
        voiceId: `drv_voice_${sampleId}` as VoiceId,
      });
      expect(removedVoice.voiceId).toBe(`drv_voice_${sampleId}`);

      const badRes = yield* ingestDriveLinks({
        folderId,
        category: "open",
        urls: ["invalid"],
      }).pipe(Effect.flip);
      expect(badRes._tag).toBe("ValidationError");
    }).pipe(Effect.provide(TestLayer));
  });
});
