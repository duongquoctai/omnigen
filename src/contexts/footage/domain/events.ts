import { Schema } from "effect";

import {
  ContentHash,
  FolderId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
  ShotId,
} from "@/contexts/shared-kernel";

export const PublishedShot = Schema.Struct({
  shotId: ShotId,
  name: Schema.NonEmptyString,
  fileName: Schema.NonEmptyString,
  category: ShotCategory,
  duration: Seconds,
  localPath: LocalPath,
  localUrl: MediaUrl,
  lockFlipH: Schema.Boolean,
  contentHash: Schema.OptionFromNullOr(ContentHash),
});
export type PublishedShot = typeof PublishedShot.Type;

export const ShotsPublished = Schema.TaggedStruct("ShotsPublished", {
  folderId: FolderId,
  shots: Schema.NonEmptyArray(PublishedShot),
});
export type ShotsPublished = typeof ShotsPublished.Type;
