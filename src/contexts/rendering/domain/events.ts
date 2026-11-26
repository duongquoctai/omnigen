import { Schema } from "effect";

import { RenderJobId } from "@/contexts/shared-kernel";

import {
  Credits,
  Percent,
  RenderedRecordId,
  RenderedRecordStatus,
  RenderFailure,
  RenderOutput,
  ZvidJobId,
} from "./types";

export const RenderValidated = Schema.TaggedStruct("RenderValidated", {
  jobId: RenderJobId,
  creditsRequired: Credits,
});
export type RenderValidated = typeof RenderValidated.Type;

export const RenderSubmitted = Schema.TaggedStruct("RenderSubmitted", {
  jobId: RenderJobId,
  providerJobId: ZvidJobId,
});
export type RenderSubmitted = typeof RenderSubmitted.Type;

export const RenderProgressed = Schema.TaggedStruct("RenderProgressed", {
  jobId: RenderJobId,
  progress: Percent,
});
export type RenderProgressed = typeof RenderProgressed.Type;

export const RenderSucceeded = Schema.TaggedStruct("RenderSucceeded", {
  jobId: RenderJobId,
  output: RenderOutput,
});
export type RenderSucceeded = typeof RenderSucceeded.Type;

export const RenderFailed = Schema.TaggedStruct("RenderFailed", {
  jobId: RenderJobId,
  reason: RenderFailure,
});
export type RenderFailed = typeof RenderFailed.Type;

export const RecordStatusChanged = Schema.TaggedStruct("RecordStatusChanged", {
  recordId: RenderedRecordId,
  status: RenderedRecordStatus,
});
export type RecordStatusChanged = typeof RecordStatusChanged.Type;
