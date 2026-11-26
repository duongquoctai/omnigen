import { Context, type Effect, type Option } from "effect";

import type {
  ClipId,
  ContentHash,
  FolderId,
  MediaUrl,
  Seconds,
  ShotCategory,
  VoiceId,
} from "@/contexts/shared-kernel";
import type { PersistenceError, UpstreamError } from "@/platform/errors";

import type { Clip, ClipLibrary, DriveFileId, PlannedVideo, VoiceClip } from "../domain/types";

export class ClipLibraryRepo extends Context.Service<
  ClipLibraryRepo,
  {
    readonly get: (folderId: FolderId) => Effect.Effect<ClipLibrary, PersistenceError>;
    readonly addClips: (
      folderId: FolderId,
      clips: ReadonlyArray<Clip>,
    ) => Effect.Effect<void, PersistenceError>;
    readonly removeClip: (
      folderId: FolderId,
      clipId: ClipId,
    ) => Effect.Effect<void, PersistenceError>;
    readonly clearCategory: (
      folderId: FolderId,
      category: ShotCategory,
    ) => Effect.Effect<void, PersistenceError>;
  }
>()("composition/ClipLibraryRepo") {}

export class VoiceLibraryRepo extends Context.Service<
  VoiceLibraryRepo,
  {
    readonly list: (
      folderId: FolderId,
    ) => Effect.Effect<ReadonlyArray<VoiceClip>, PersistenceError>;
    readonly addVoices: (
      folderId: FolderId,
      voices: ReadonlyArray<VoiceClip>,
    ) => Effect.Effect<void, PersistenceError>;
    readonly removeVoice: (
      folderId: FolderId,
      voiceId: VoiceId,
    ) => Effect.Effect<void, PersistenceError>;
  }
>()("composition/VoiceLibraryRepo") {}

export interface ProbedDriveMedia {
  readonly fileId: DriveFileId;
  readonly name: string;
  readonly duration: Seconds;
  readonly streamUrl: MediaUrl;
  readonly lockFlipH: boolean;
  readonly contentHash: Option.Option<ContentHash>;
}

export class DriveMediaGateway extends Context.Service<
  DriveMediaGateway,
  {
    readonly probeClip: (fileId: DriveFileId) => Effect.Effect<ProbedDriveMedia, UpstreamError>;
    readonly probeVoice: (fileId: DriveFileId) => Effect.Effect<ProbedDriveMedia, UpstreamError>;
  }
>()("composition/DriveMediaGateway") {}

export class RenderedTuplesQuery extends Context.Service<
  RenderedTuplesQuery,
  {
    readonly forFolder: (
      folderId: FolderId,
    ) => Effect.Effect<ReadonlyArray<string>, PersistenceError>;
  }
>()("composition/RenderedTuplesQuery") {}

export class PlannedVideoRepo extends Context.Service<
  PlannedVideoRepo,
  {
    readonly replaceAll: (
      folderId: FolderId,
      videos: ReadonlyArray<PlannedVideo>,
    ) => Effect.Effect<void, PersistenceError>;
  }
>()("composition/PlannedVideoRepo") {}
