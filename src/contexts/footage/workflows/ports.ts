import { Context, type Effect } from "effect";

import type { FolderId, ShotId } from "@/contexts/shared-kernel";
import type { PersistenceError, StorageError } from "@/platform/errors";

import type { SceneDetectionFailed, SlicingFailed } from "../domain/errors";
import type {
  CategoryMinDurations,
  ClassifiedShot,
  Scene,
  Shot,
  SourceVideo,
} from "../domain/types";

export interface DetectScenesParams {
  readonly sourceVideo: SourceVideo;
  readonly detector: "content" | "adaptive";
  readonly threshold: number;
  readonly minSceneLen: number;
}

export interface SlicedClipResult {
  readonly shotId: string;
  readonly category: string;
  readonly localPath: string;
  readonly localUrl: string;
  readonly duration: number;
}

export interface SliceShotsParams {
  readonly sessionId: string;
  readonly sourcePath: string;
  readonly shots: ReadonlyArray<Shot>;
  readonly minDurations: CategoryMinDurations;
}

export class FootageRepo extends Context.Service<
  FootageRepo,
  {
    readonly getSourceVideo: (
      sessionId: string,
    ) => Effect.Effect<SourceVideo, PersistenceError | StorageError>;
    readonly saveShots: (
      sessionId: string,
      shots: ReadonlyArray<ClassifiedShot>,
      minDurations: CategoryMinDurations,
    ) => Effect.Effect<void, PersistenceError>;
  }
>()("footage/FootageRepo") {}

export class SceneDetector extends Context.Service<
  SceneDetector,
  {
    readonly detect: (
      params: DetectScenesParams,
    ) => Effect.Effect<ReadonlyArray<Scene>, SceneDetectionFailed>;
  }
>()("footage/SceneDetector") {}

export class ShotSlicer extends Context.Service<
  ShotSlicer,
  {
    readonly slice: (
      params: SliceShotsParams,
    ) => Effect.Effect<ReadonlyArray<SlicedClipResult>, SlicingFailed>;
  }
>()("footage/ShotSlicer") {}

export class ShotIdGenerator extends Context.Service<
  ShotIdGenerator,
  {
    readonly makeId: (folderId: FolderId | string, index: number) => ShotId;
  }
>()("footage/ShotIdGenerator") {}
