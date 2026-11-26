import { Schema } from "effect";

import { FolderId, MediaUrl, RenderJobId, Seconds } from "@/contexts/shared-kernel";

export const ZvidJobId = Schema.NonEmptyString.pipe(Schema.brand("ZvidJobId"));
export type ZvidJobId = typeof ZvidJobId.Type;

export const Percent = Schema.Number.check(Schema.isBetween({ minimum: 0, maximum: 100 })).pipe(
  Schema.brand("Percent"),
);
export type Percent = typeof Percent.Type;

export const Credits = Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)).pipe(
  Schema.brand("Credits"),
);
export type Credits = typeof Credits.Type;

export const RenderOutput = Schema.Struct({
  remoteUrl: MediaUrl,
  localUrl: MediaUrl,
  expiresAt: Schema.OptionFromNullOr(Schema.String),
});
export type RenderOutput = typeof RenderOutput.Type;

export const RenderFailure = Schema.Struct({
  code: Schema.NonEmptyString,
  message: Schema.NonEmptyString,
});
export type RenderFailure = typeof RenderFailure.Type;

export const RenderPlanRef = Schema.Struct({
  plannedVideoId: Schema.NonEmptyString,
  folderId: FolderId,
  name: Schema.NonEmptyString,
  tupleKey: Schema.NonEmptyString,
  duration: Seconds,
});
export type RenderPlanRef = typeof RenderPlanRef.Type;

export const RenderJob = Schema.Union([
  Schema.TaggedStruct("Draft", {
    id: RenderJobId,
    plan: RenderPlanRef,
  }),
  Schema.TaggedStruct("Validated", {
    id: RenderJobId,
    plan: RenderPlanRef,
    creditsRequired: Credits,
  }),
  Schema.TaggedStruct("Submitted", {
    id: RenderJobId,
    plan: RenderPlanRef,
    providerJobId: ZvidJobId,
    submittedAt: Schema.String,
  }),
  Schema.TaggedStruct("Running", {
    id: RenderJobId,
    plan: RenderPlanRef,
    providerJobId: ZvidJobId,
    progress: Percent,
  }),
  Schema.TaggedStruct("Succeeded", {
    id: RenderJobId,
    plan: RenderPlanRef,
    providerJobId: ZvidJobId,
    output: RenderOutput,
    finishedAt: Schema.String,
  }),
  Schema.TaggedStruct("Failed", {
    id: RenderJobId,
    plan: RenderPlanRef,
    reason: RenderFailure,
    failedAt: Schema.String,
  }),
]);
export type RenderJob = typeof RenderJob.Type;

export const RenderedRecordId = Schema.NonEmptyString.pipe(Schema.brand("RenderedRecordId"));
export type RenderedRecordId = typeof RenderedRecordId.Type;

export const RenderedRecordStatus = Schema.Literals(["unused", "used"]);
export type RenderedRecordStatus = typeof RenderedRecordStatus.Type;

export const RenderedRecord = Schema.Struct({
  id: RenderedRecordId,
  folderId: FolderId,
  tupleKey: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  outputUrl: Schema.OptionFromNullOr(MediaUrl),
  status: RenderedRecordStatus,
  renderedAt: Schema.String,
  payload: Schema.optional(Schema.Unknown),
});
export type RenderedRecord = typeof RenderedRecord.Type;
