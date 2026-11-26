import { Schema } from "effect";

import { FolderId } from "@/contexts/shared-kernel";

import { Clip, PlannedVideo } from "./types";

export const ClipsAdded = Schema.TaggedStruct("ClipsAdded", {
  folderId: FolderId,
  clips: Schema.Array(Clip),
});
export type ClipsAdded = typeof ClipsAdded.Type;

export const MixPlanned = Schema.TaggedStruct("MixPlanned", {
  folderId: FolderId,
  videos: Schema.NonEmptyArray(PlannedVideo),
});
export type MixPlanned = typeof MixPlanned.Type;
