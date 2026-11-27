import { Effect, Option, Schema } from "effect";

import { ClipId, FolderId, ShotCategory, VoiceId } from "@/contexts/shared-kernel";
import { ValidationError } from "@/platform/errors";

import { extractGoogleDriveFileId } from "../domain/drive-parser";
import type { Clip, DriveFileId, VoiceClip } from "../domain/types";
import { ClipLibraryRepo, DriveMediaGateway, VoiceLibraryRepo } from "./ports";

export const IngestDriveLinksInput = Schema.Struct({
  folderId: FolderId,
  category: ShotCategory,
  urls: Schema.Array(Schema.String),
});
export type IngestDriveLinksInput = typeof IngestDriveLinksInput.Type;

export const IngestDriveVoicesInput = Schema.Struct({
  folderId: FolderId,
  urls: Schema.Array(Schema.String),
});
export type IngestDriveVoicesInput = typeof IngestDriveVoicesInput.Type;

export const RemoveClipInput = Schema.Struct({
  folderId: FolderId,
  clipId: ClipId,
});
export type RemoveClipInput = typeof RemoveClipInput.Type;

export const ClearCategoryInput = Schema.Struct({
  folderId: FolderId,
  category: ShotCategory,
});
export type ClearCategoryInput = typeof ClearCategoryInput.Type;

export const RemoveVoiceInput = Schema.Struct({
  folderId: FolderId,
  voiceId: VoiceId,
});
export type RemoveVoiceInput = typeof RemoveVoiceInput.Type;

const partitionDriveUrls = (urls: ReadonlyArray<string>) => {
  const validIds: Array<DriveFileId> = [];
  const skippedUrls: Array<string> = [];
  const seen = new Set<string>();

  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const extracted = extractGoogleDriveFileId(trimmed);
    if (Option.isNone(extracted)) {
      skippedUrls.push(trimmed);
      continue;
    }
    if (!seen.has(extracted.value)) {
      seen.add(extracted.value);
      validIds.push(extracted.value);
    }
  }

  return { validIds, skippedUrls } as const;
};

export const DRIVE_PROBE_CONCURRENCY = 16;

export const ingestDriveLinks = (input: IngestDriveLinksInput) =>
  Effect.gen(function* () {
    const drive = yield* DriveMediaGateway;
    const clipRepo = yield* ClipLibraryRepo;

    const { validIds, skippedUrls } = partitionDriveUrls(input.urls);
    if (validIds.length === 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Không tìm thấy liên kết Google Drive hợp lệ nào.",
        }),
      );
    }

    const probed = yield* Effect.all(
      validIds.map((fileId) => drive.probeClip(fileId)),
      { concurrency: DRIVE_PROBE_CONCURRENCY },
    );

    const clips: ReadonlyArray<Clip> = probed.map((media) => ({
      id: `drv_${media.fileId}` as ClipId,
      name: media.name,
      fileName: `${media.name}.mp4`,
      category: input.category,
      duration: media.duration,
      source: {
        _tag: "DriveClip",
        fileId: media.fileId,
        streamUrl: media.streamUrl,
      },
      lockFlipH: media.lockFlipH,
      contentHash: media.contentHash,
    }));

    yield* clipRepo.addClips(input.folderId, clips);

    return {
      addedCount: clips.length,
      clips,
      skippedUrls,
    } as const;
  });

export const ingestDriveVoices = (input: IngestDriveVoicesInput) =>
  Effect.gen(function* () {
    const drive = yield* DriveMediaGateway;
    const voiceRepo = yield* VoiceLibraryRepo;

    const { validIds, skippedUrls } = partitionDriveUrls(input.urls);
    if (validIds.length === 0) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Không tìm thấy liên kết Google Drive voice hợp lệ nào.",
        }),
      );
    }

    const probed = yield* Effect.all(
      validIds.map((fileId) => drive.probeVoice(fileId)),
      { concurrency: DRIVE_PROBE_CONCURRENCY },
    );

    const voices: ReadonlyArray<VoiceClip> = probed.map((media) => ({
      id: `drv_voice_${media.fileId}` as VoiceId,
      name: media.name,
      fileName: `${media.name}.mp3`,
      localUrl: media.streamUrl,
      localPath: Option.none(),
      duration: media.duration,
    }));

    yield* voiceRepo.addVoices(input.folderId, voices);

    return {
      addedCount: voices.length,
      voices,
      skippedUrls,
    } as const;
  });

export const removeClipFromLibrary = (input: RemoveClipInput) =>
  Effect.gen(function* () {
    const clipRepo = yield* ClipLibraryRepo;
    yield* clipRepo.removeClip(input.folderId, input.clipId);
    return { clipId: input.clipId } as const;
  });

export const clearCategoryPool = (input: ClearCategoryInput) =>
  Effect.gen(function* () {
    const clipRepo = yield* ClipLibraryRepo;
    yield* clipRepo.clearCategory(input.folderId, input.category);
    return { category: input.category } as const;
  });

export const removeVoiceTrack = (input: RemoveVoiceInput) =>
  Effect.gen(function* () {
    const voiceRepo = yield* VoiceLibraryRepo;
    yield* voiceRepo.removeVoice(input.folderId, input.voiceId);
    return { voiceId: input.voiceId } as const;
  });
