"use server";

import { Effect, Layer, ManagedRuntime, Option } from "effect";

import { makeAction } from "@/platform/run";
import { AppLayer } from "@/platform/runtime";

import { RenderedHistoryRepoLive } from "../adapters/rendered-history-repo";
import {
  clearRenderedHistory,
  ClearRenderedHistoryInput,
  deleteRenderedRecord,
  DeleteRenderedRecordInput,
  listRenderedHistory,
  ListRenderedHistoryInput,
  markRecordUsed,
  MarkRecordUsedInput,
  recordRenderedBatch,
  RecordRenderedBatchInput,
} from "../workflows/mark-record-used";

const RenderingLayer = Layer.mergeAll(
  AppLayer,
  RenderedHistoryRepoLive.pipe(Layer.provide(AppLayer)),
);

const renderingRuntime = ManagedRuntime.make(RenderingLayer);

export const toggleRecordUsedAction = makeAction(
  MarkRecordUsedInput,
  markRecordUsed,
  renderingRuntime,
);

export const deleteRenderedRecordAction = makeAction(
  DeleteRenderedRecordInput,
  deleteRenderedRecord,
  renderingRuntime,
);

export const clearRenderedHistoryAction = makeAction(
  ClearRenderedHistoryInput,
  clearRenderedHistory,
  renderingRuntime,
);

export const listRenderedHistoryAction = makeAction(
  ListRenderedHistoryInput,
  (input) =>
    Effect.map(listRenderedHistory(input), (res) => ({
      records: res.records.map((r) => ({
        ...r,
        outputUrl: Option.getOrNull(r.outputUrl),
      })),
    })),
  renderingRuntime,
);

export const recordRenderedBatchAction = makeAction(
  RecordRenderedBatchInput,
  (input) =>
    Effect.map(recordRenderedBatch(input), (res) => ({
      addedCount: res.addedCount,
      records: res.records.map((r) => ({
        ...r,
        outputUrl: Option.getOrNull(r.outputUrl),
      })),
    })),
  renderingRuntime,
);
