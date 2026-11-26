import { Schema } from "effect";

import {
  ClipId,
  ContentHash,
  FolderId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
  ShotId,
  SourceVideoId,
  VoiceId,
} from "@/contexts/shared-kernel";

export const DriveFileId = Schema.NonEmptyString.pipe(Schema.brand("DriveFileId"));
export type DriveFileId = typeof DriveFileId.Type;

export const ClipSource = Schema.Union([
  Schema.TaggedStruct("LocalClip", {
    localPath: LocalPath,
    localUrl: MediaUrl,
  }),
  Schema.TaggedStruct("DriveClip", {
    fileId: DriveFileId,
    streamUrl: MediaUrl,
  }),
  Schema.TaggedStruct("FromShotClip", {
    shotId: ShotId,
    folderId: FolderId,
    localPath: LocalPath,
    localUrl: MediaUrl,
  }),
]);
export type ClipSource = typeof ClipSource.Type;

export const Clip = Schema.Struct({
  id: ClipId,
  name: Schema.NonEmptyString,
  fileName: Schema.NonEmptyString,
  category: ShotCategory,
  duration: Seconds,
  source: ClipSource,
  lockFlipH: Schema.Boolean,
  contentHash: Schema.OptionFromNullOr(ContentHash),
});
export type Clip = typeof Clip.Type;

export const ClipLibrary = Schema.Struct({
  open: Schema.Array(Clip),
  product: Schema.Array(Clip),
  texture: Schema.Array(Clip),
  apply: Schema.Array(Clip),
  end: Schema.Array(Clip),
});
export type ClipLibrary = typeof ClipLibrary.Type;

export const VoiceClip = Schema.Struct({
  id: VoiceId,
  name: Schema.NonEmptyString,
  fileName: Schema.NonEmptyString,
  localUrl: MediaUrl,
  localPath: Schema.OptionFromNullOr(LocalPath),
  duration: Seconds,
});
export type VoiceClip = typeof VoiceClip.Type;

export const SyncMode = Schema.Literals(["voice_master", "video_master", "shorter_wins"]);
export type SyncMode = typeof SyncMode.Type;

export const HammingDistance = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 5 })).pipe(
  Schema.brand("HammingDistance"),
);
export type HammingDistance = typeof HammingDistance.Type;

export const TargetCount = Schema.Int.check(Schema.isGreaterThan(0)).pipe(
  Schema.brand("TargetCount"),
);
export type TargetCount = typeof TargetCount.Type;

export const MaxShotFrequency = Schema.Int.check(Schema.isGreaterThan(0)).pipe(
  Schema.brand("MaxShotFrequency"),
);
export type MaxShotFrequency = typeof MaxShotFrequency.Type;

export const DiversityRules = Schema.Struct({
  targetCount: TargetCount,
  targetOutputDuration: Seconds,
  minHammingDistance: HammingDistance,
  maxShotFrequency: MaxShotFrequency,
  enableAutoVariantEdits: Schema.Boolean,
  randomTransitionDuration: Seconds,
  seed: Schema.Int,
});
export type DiversityRules = typeof DiversityRules.Type;

export const CompositionTuple = Schema.Struct({
  open: ClipId,
  product: ClipId,
  texture: ClipId,
  apply: ClipId,
  end: ClipId,
});
export type CompositionTuple = typeof CompositionTuple.Type;

export const PlannedSlot = Schema.Struct({
  category: ShotCategory,
  clipId: ClipId,
  clipLabel: Schema.String,
  sourceVideoId: SourceVideoId,
  videoBegin: Seconds,
  videoEnd: Seconds,
  originalVideoEnd: Schema.optional(Seconds),
  enterBegin: Seconds,
  exitEnd: Seconds,
  localUrl: MediaUrl,
  speed: Schema.Number.check(Schema.isBetween({ minimum: 0.1, maximum: 10 })),
  flipH: Schema.Boolean,
});
export type PlannedSlot = typeof PlannedSlot.Type;

export const PlannedVideoId = Schema.NonEmptyString.pipe(Schema.brand("PlannedVideoId"));
export type PlannedVideoId = typeof PlannedVideoId.Type;

export const PlannedVideo = Schema.Struct({
  id: PlannedVideoId,
  name: Schema.NonEmptyString,
  tupleKey: Schema.optional(Schema.String),
  tuple: CompositionTuple,
  slots: Schema.NonEmptyArray(PlannedSlot),
  totalVisualDuration: Seconds,
  finalDuration: Seconds,
  voiceId: Schema.OptionFromNullOr(VoiceId),
  syncMode: SyncMode,
});
export type PlannedVideo = typeof PlannedVideo.Type;
