import { Schema } from "effect";

import {
  ContentHash,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
  ShotId,
  SourceVideoId,
} from "@/contexts/shared-kernel";

export const Speed = Schema.Number.check(Schema.isBetween({ minimum: 0.1, maximum: 10 })).pipe(
  Schema.brand("Speed"),
);
export type Speed = typeof Speed.Type;

export const ZoomDepth = Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })).pipe(
  Schema.brand("ZoomDepth"),
);
export type ZoomDepth = typeof ZoomDepth.Type;

export const TransitionDuration = Schema.Number.check(
  Schema.isBetween({ minimum: 0.3, maximum: 1.5 }),
).pipe(Schema.brand("TransitionDuration"));
export type TransitionDuration = typeof TransitionDuration.Type;

export const XFadeEffect = Schema.Literals([
  "fade",
  "fadeblack",
  "fadewhite",
  "wipeleft",
  "wiperight",
  "slideleft",
  "slideright",
  "smoothleft",
  "smoothright",
  "circleopen",
  "dissolve",
]);
export type XFadeEffect = typeof XFadeEffect.Type;

export const TimeRange = Schema.Struct({
  begin: Seconds,
  end: Seconds,
})
  .check(Schema.makeFilter((r) => r.end > r.begin || "end must be greater than begin"))
  .pipe(Schema.brand("TimeRange"));
export type TimeRange = typeof TimeRange.Type;

export const Zoom = Schema.Union([
  Schema.TaggedStruct("NoZoom", {}),
  Schema.TaggedStruct("AutoZoom", {}),
  Schema.TaggedStruct("FixedZoom", { depth: ZoomDepth }),
]);
export type Zoom = typeof Zoom.Type;

export const FlipSetting = Schema.Union([
  Schema.TaggedStruct("Unflipped", { locked: Schema.Boolean }),
  Schema.TaggedStruct("Flipped", { locked: Schema.Boolean }),
]);
export type FlipSetting = typeof FlipSetting.Type;

export const CropParams = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number.check(Schema.isGreaterThan(0)),
  height: Schema.Number.check(Schema.isGreaterThan(0)),
});
export type CropParams = typeof CropParams.Type;

export const TransitionSetting = Schema.Union([
  Schema.TaggedStruct("NoTransition", {}),
  Schema.TaggedStruct("XFadeTransition", {
    effect: XFadeEffect,
    duration: TransitionDuration,
  }),
]);
export type TransitionSetting = typeof TransitionSetting.Type;

export const ShotEdits = Schema.Struct({
  flip: FlipSetting,
  speed: Speed,
  zoom: Zoom,
  crop: Schema.OptionFromNullOr(CropParams),
  transition: TransitionSetting,
});
export type ShotEdits = typeof ShotEdits.Type;

export const Scene = Schema.Struct({
  range: TimeRange,
});
export type Scene = typeof Scene.Type;

export const SourceVideo = Schema.Struct({
  id: SourceVideoId,
  name: Schema.NonEmptyString,
  fileName: Schema.NonEmptyString,
  localUrl: MediaUrl,
  localPath: LocalPath,
  sizeBytes: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  duration: Seconds,
  width: Schema.Number.check(Schema.isGreaterThan(0)),
  height: Schema.Number.check(Schema.isGreaterThan(0)),
  createdAt: Schema.String,
});
export type SourceVideo = typeof SourceVideo.Type;

const shotBaseFields = {
  id: ShotId,
  sourceVideoId: SourceVideoId,
  label: Schema.String,
  range: TimeRange,
  detectedRange: TimeRange,
  contentHash: Schema.OptionFromNullOr(ContentHash),
  edits: ShotEdits,
};

export const DraftShot = Schema.TaggedStruct("DraftShot", shotBaseFields);
export type DraftShot = typeof DraftShot.Type;

export const ClassifiedShot = Schema.TaggedStruct("ClassifiedShot", {
  ...shotBaseFields,
  category: ShotCategory,
});
export type ClassifiedShot = typeof ClassifiedShot.Type;

export const Shot = Schema.Union([DraftShot, ClassifiedShot]);
export type Shot = typeof Shot.Type;

export const CategoryMinDurations = Schema.Struct({
  open: Seconds,
  product: Seconds,
  texture: Seconds,
  apply: Seconds,
  end: Seconds,
});
export type CategoryMinDurations = typeof CategoryMinDurations.Type;
