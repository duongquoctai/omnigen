import { Schema } from "effect";

// Branded IDs shared across bounded contexts
export const ProjectId = Schema.NonEmptyString.pipe(Schema.brand("ProjectId"));
export type ProjectId = typeof ProjectId.Type;

export const FolderId = Schema.NonEmptyString.pipe(Schema.brand("FolderId"));
export type FolderId = typeof FolderId.Type;

export const UserId = Schema.NonEmptyString.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const SourceVideoId = Schema.NonEmptyString.pipe(Schema.brand("SourceVideoId"));
export type SourceVideoId = typeof SourceVideoId.Type;

export const ShotId = Schema.NonEmptyString.pipe(Schema.brand("ShotId"));
export type ShotId = typeof ShotId.Type;

export const ClipId = Schema.NonEmptyString.pipe(Schema.brand("ClipId"));
export type ClipId = typeof ClipId.Type;

export const VoiceId = Schema.NonEmptyString.pipe(Schema.brand("VoiceId"));
export type VoiceId = typeof VoiceId.Type;

export const RenderJobId = Schema.NonEmptyString.pipe(Schema.brand("RenderJobId"));
export type RenderJobId = typeof RenderJobId.Type;

// Shared domain value objects
export const SHOT_CATEGORY_VALUES = ["open", "product", "texture", "apply", "end"] as const;
export const ShotCategory = Schema.Literals(SHOT_CATEGORY_VALUES);
export type ShotCategory = typeof ShotCategory.Type;

export const Seconds = Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)).pipe(
  Schema.brand("Seconds"),
);
export type Seconds = typeof Seconds.Type;

export const MediaUrl = Schema.NonEmptyString.pipe(Schema.brand("MediaUrl"));
export type MediaUrl = typeof MediaUrl.Type;

export const LocalPath = Schema.NonEmptyString.pipe(Schema.brand("LocalPath"));
export type LocalPath = typeof LocalPath.Type;

export const ContentHash = Schema.NonEmptyString.pipe(Schema.brand("ContentHash"));
export type ContentHash = typeof ContentHash.Type;
