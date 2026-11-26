import { Effect, Schema } from "effect";

import { FolderId } from "@/contexts/shared-kernel";

import type { RecordStatusChanged } from "../domain/events";
import { setRecordUsed } from "../domain/render-job";
import { RenderedRecordId } from "../domain/types";
import { RenderedHistoryRepo } from "./ports";

export const MarkRecordUsedInput = Schema.Struct({
  recordId: RenderedRecordId,
  used: Schema.Boolean,
});
export type MarkRecordUsedInput = typeof MarkRecordUsedInput.Type;

export const DeleteRenderedRecordInput = Schema.Struct({
  recordId: RenderedRecordId,
});
export type DeleteRenderedRecordInput = typeof DeleteRenderedRecordInput.Type;

export const RecordRenderedBatchEntrySchema = Schema.Struct({
  tupleKey: Schema.String,
  name: Schema.String,
  payload: Schema.optional(Schema.Unknown),
});

export const RecordRenderedBatchInput = Schema.Struct({
  folderId: FolderId,
  records: Schema.Array(RecordRenderedBatchEntrySchema),
});
export type RecordRenderedBatchInput = typeof RecordRenderedBatchInput.Type;

export const ListRenderedHistoryInput = Schema.Struct({
  folderId: FolderId,
});
export type ListRenderedHistoryInput = typeof ListRenderedHistoryInput.Type;

export const ClearRenderedHistoryInput = Schema.Struct({
  folderId: FolderId,
});
export type ClearRenderedHistoryInput = typeof ClearRenderedHistoryInput.Type;

export const markRecordUsed = (input: MarkRecordUsedInput) =>
  Effect.gen(function* () {
    const repo = yield* RenderedHistoryRepo;
    const existing = yield* repo.findById(input.recordId);
    const updated = setRecordUsed(existing, input.used);
    yield* repo.updateStatus(updated.id, updated.status);

    return {
      _tag: "RecordStatusChanged",
      recordId: updated.id,
      status: updated.status,
    } satisfies RecordStatusChanged;
  });

export const deleteRenderedRecord = (input: DeleteRenderedRecordInput) =>
  Effect.gen(function* () {
    const repo = yield* RenderedHistoryRepo;
    yield* repo.remove(input.recordId);
    return { recordId: input.recordId } as const;
  });

export const recordRenderedBatch = (input: RecordRenderedBatchInput) =>
  Effect.gen(function* () {
    const repo = yield* RenderedHistoryRepo;
    const created = yield* repo.recordBatch(input.folderId, input.records);
    return {
      addedCount: created.length,
      records: created,
    } as const;
  });

export const listRenderedHistory = (input: ListRenderedHistoryInput) =>
  Effect.gen(function* () {
    const repo = yield* RenderedHistoryRepo;
    const records = yield* repo.listByFolder(input.folderId);
    return { records } as const;
  });

export const clearRenderedHistory = (input: ClearRenderedHistoryInput) =>
  Effect.gen(function* () {
    const repo = yield* RenderedHistoryRepo;
    yield* repo.clearByFolder(input.folderId);
    return { folderId: input.folderId } as const;
  });
