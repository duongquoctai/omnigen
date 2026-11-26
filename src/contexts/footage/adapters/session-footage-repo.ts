import "server-only";

import fs from "node:fs";
import path from "node:path";

import { Effect, Layer } from "effect";

import type { LocalPath, MediaUrl, Seconds, ShotId, SourceVideoId } from "@/contexts/shared-kernel";
import { PersistenceError, StorageError } from "@/platform/errors";
import { MediaStorage } from "@/platform/storage/media-storage";

import { FootageRepo, ShotIdGenerator } from "../workflows/ports";
import { shotToLegacyDto } from "./shot-dto";

interface LegacySessionState {
  sourceVideo?: {
    id: string;
    name: string;
    fileName: string;
    localUrl: string;
    localPath: string;
    sizeBytes: number;
    duration: number;
    width: number;
    height: number;
    createdAt: string;
  } | null;
  categoryMinDurations?: Record<string, number>;
  shots?: unknown[];
  composedVideos?: unknown[];
  [key: string]: unknown;
}

const getSessionStateFile = (
  storage: ReturnType<typeof MediaStorage.of>,
  rawSessionId: string,
): string => {
  const paths = storage.getSessionPaths(rawSessionId);
  return path.join(paths.root, "project_state.json");
};

export const SessionFootageRepoLive = Layer.effect(
  FootageRepo,
  Effect.gen(function* () {
    const storage = yield* MediaStorage;

    return {
      getSourceVideo: (rawSessionId) =>
        Effect.try({
          try: () => {
            const stateFile = getSessionStateFile(storage, rawSessionId);
            if (!fs.existsSync(stateFile)) {
              throw new Error("Phiên làm việc không tồn tại hoặc đã hết hạn.");
            }
            const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as LegacySessionState;
            if (!state.sourceVideo) {
              throw new Error("Chưa có source video để xử lý.");
            }
            return {
              id: state.sourceVideo.id as SourceVideoId,
              name: state.sourceVideo.name,
              fileName: state.sourceVideo.fileName,
              localUrl: state.sourceVideo.localUrl as MediaUrl,
              localPath: state.sourceVideo.localPath as LocalPath,
              sizeBytes: state.sourceVideo.sizeBytes,
              duration: state.sourceVideo.duration as Seconds,
              width: state.sourceVideo.width,
              height: state.sourceVideo.height,
              createdAt: state.sourceVideo.createdAt,
            };
          },
          catch: (cause) =>
            new StorageError({
              message: cause instanceof Error ? cause.message : String(cause),
              cause,
            }),
        }),
      saveShots: (rawSessionId, shots, minDurations) =>
        Effect.try({
          try: () => {
            const stateFile = getSessionStateFile(storage, rawSessionId);
            fs.mkdirSync(path.dirname(stateFile), { recursive: true });
            const existing = fs.existsSync(stateFile)
              ? (JSON.parse(fs.readFileSync(stateFile, "utf8")) as LegacySessionState)
              : {};
            const nextState: LegacySessionState = {
              ...existing,
              categoryMinDurations: minDurations,
              shots: shots.map(shotToLegacyDto),
              composedVideos: [],
            };
            fs.writeFileSync(stateFile, JSON.stringify(nextState, null, 2), "utf8");
          },
          catch: (cause) =>
            new PersistenceError({
              message: cause instanceof Error ? cause.message : String(cause),
              cause,
            }),
        }),
    };
  }),
);

export const ShotIdGeneratorLive = Layer.succeed(ShotIdGenerator, {
  makeId: (_folderId, index) => `shot_pyscene_${String(index + 1)}_${String(Date.now())}` as ShotId,
});
