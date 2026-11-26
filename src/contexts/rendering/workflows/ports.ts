import { Context, type Effect } from "effect";

import type { FolderId, MediaUrl, RenderJobId } from "@/contexts/shared-kernel";
import type { PersistenceError } from "@/platform/errors";

import type {
  MediaDownloadFailed,
  RecordNotFound,
  RenderJobNotFound,
  ZvidSubmitFailed,
  ZvidValidationFailed,
} from "../domain/errors";
import type {
  Credits,
  RenderedRecord,
  RenderedRecordId,
  RenderedRecordStatus,
  RenderJob,
  ZvidJobId,
} from "../domain/types";

export class RenderJobRepo extends Context.Service<
  RenderJobRepo,
  {
    readonly findById: (
      id: RenderJobId,
    ) => Effect.Effect<RenderJob, RenderJobNotFound | PersistenceError>;
    readonly findByProviderJobId: (
      providerJobId: ZvidJobId,
    ) => Effect.Effect<RenderJob, RenderJobNotFound | PersistenceError>;
    readonly save: (job: RenderJob) => Effect.Effect<void, PersistenceError>;
  }
>()("rendering/RenderJobRepo") {}

export interface RenderedBatchEntry {
  readonly tupleKey: string;
  readonly name: string;
  readonly payload?: unknown;
}

export class RenderedHistoryRepo extends Context.Service<
  RenderedHistoryRepo,
  {
    readonly listByFolder: (
      folderId: FolderId,
    ) => Effect.Effect<ReadonlyArray<RenderedRecord>, PersistenceError>;
    readonly findById: (
      id: RenderedRecordId,
    ) => Effect.Effect<RenderedRecord, RecordNotFound | PersistenceError>;
    readonly record: (
      job: Extract<RenderJob, { readonly _tag: "Succeeded" }>,
    ) => Effect.Effect<void, PersistenceError>;
    readonly recordBatch: (
      folderId: FolderId,
      entries: ReadonlyArray<RenderedBatchEntry>,
    ) => Effect.Effect<ReadonlyArray<RenderedRecord>, PersistenceError>;
    readonly updateStatus: (
      id: RenderedRecordId,
      status: RenderedRecordStatus,
    ) => Effect.Effect<void, PersistenceError>;
    readonly remove: (id: RenderedRecordId) => Effect.Effect<void, PersistenceError>;
    readonly clearByFolder: (folderId: FolderId) => Effect.Effect<void, PersistenceError>;
  }
>()("rendering/RenderedHistoryRepo") {}

export class ZvidGateway extends Context.Service<
  ZvidGateway,
  {
    readonly validate: (
      job: Extract<RenderJob, { readonly _tag: "Draft" }>,
    ) => Effect.Effect<Credits, ZvidValidationFailed>;
    readonly submit: (
      job: Extract<RenderJob, { readonly _tag: "Validated" }>,
    ) => Effect.Effect<ZvidJobId, ZvidSubmitFailed>;
  }
>()("rendering/ZvidGateway") {}

export class MediaDownloader extends Context.Service<
  MediaDownloader,
  {
    readonly persistRemoteVideo: (
      remoteUrl: MediaUrl,
      jobId: RenderJobId,
    ) => Effect.Effect<MediaUrl, MediaDownloadFailed>;
  }
>()("rendering/MediaDownloader") {}
