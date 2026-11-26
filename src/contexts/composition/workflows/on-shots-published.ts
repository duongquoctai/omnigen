import { Effect } from "effect";

import type { ClipId, FolderId, LocalPath, MediaUrl, Seconds } from "@/contexts/shared-kernel";

import type { ClipsAdded } from "../domain/events";
import type { Clip } from "../domain/types";
import { ClipLibraryRepo } from "./ports";

export interface PublishedShotEventPayload {
  readonly shotId: string;
  readonly name: string;
  readonly fileName: string;
  readonly category: Clip["category"];
  readonly duration: Seconds;
  readonly localPath: LocalPath;
  readonly localUrl: MediaUrl;
  readonly lockFlipH: boolean;
  readonly contentHash: Clip["contentHash"];
}

export interface ShotsPublishedEventInput {
  readonly folderId: FolderId;
  readonly shots: ReadonlyArray<PublishedShotEventPayload>;
}

export const onShotsPublished = (event: ShotsPublishedEventInput) =>
  Effect.gen(function* () {
    const repo = yield* ClipLibraryRepo;
    const clips: ReadonlyArray<Clip> = event.shots.map((s) => ({
      id: `clip_${s.shotId}` as ClipId,
      name: s.name,
      fileName: s.fileName,
      category: s.category,
      duration: s.duration,
      source: {
        _tag: "FromShotClip",
        shotId: s.shotId as unknown as Extract<Clip["source"], { _tag: "FromShotClip" }>["shotId"],
        folderId: event.folderId,
        localPath: s.localPath,
        localUrl: s.localUrl,
      },
      lockFlipH: s.lockFlipH,
      contentHash: s.contentHash,
    }));

    yield* repo.addClips(event.folderId, clips);

    return {
      _tag: "ClipsAdded",
      folderId: event.folderId,
      clips,
    } satisfies ClipsAdded;
  });
