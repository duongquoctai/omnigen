import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Context, Effect, Layer } from "effect";

import { StorageError } from "../errors";

export interface SessionPaths {
  readonly root: string;
  readonly sourceDir: string;
  readonly slicesDir: string;
  readonly categoriesDir: string;
  readonly voicesDir: string;
  readonly outputsDir: string;
}

export interface MediaStorageValue {
  readonly baseSessionsDir: string;
  readonly dataDir: string;
  readonly sanitizeSessionId: (raw?: string | null) => string;
  readonly getSessionPaths: (sessionId: string) => SessionPaths;
  readonly resolveSafePath: (
    segments: ReadonlyArray<string>,
  ) => Effect.Effect<string, StorageError>;
}

export class MediaStorage extends Context.Service<MediaStorage, MediaStorageValue>()(
  "platform/MediaStorage",
) {}

const isPathInside = (parentDir: string, candidatePath: string): boolean => {
  const rel = path.relative(path.resolve(parentDir), path.resolve(candidatePath));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

export const makeMediaStorage = (options?: {
  readonly baseSessionsDir?: string;
  readonly dataDir?: string;
}): MediaStorageValue => {
  const baseSessionsDir = options?.baseSessionsDir ?? path.join(os.tmpdir(), "lachvid_sessions");
  const dataDir = options?.dataDir ?? path.join(process.cwd(), "data");

  const sanitizeSessionId = (raw?: string | null): string => {
    if (!raw || typeof raw !== "string") return "default_session";
    const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    return cleaned.length > 0 ? cleaned : "default_session";
  };

  const getSessionPaths = (sessionId: string): SessionPaths => {
    const safe = sanitizeSessionId(sessionId);
    const root = path.join(baseSessionsDir, safe);
    return {
      root,
      sourceDir: path.join(root, "source"),
      slicesDir: path.join(root, "slices"),
      categoriesDir: path.join(root, "categories"),
      voicesDir: path.join(root, "voices"),
      outputsDir: path.join(root, "outputs"),
    };
  };

  const resolveSafePath = (segments: ReadonlyArray<string>): Effect.Effect<string, StorageError> =>
    Effect.try({
      try: () => {
        if (segments.length === 0) {
          throw new Error("Missing media path segments");
        }
        const candidates: Array<{ root: string; target: string }> =
          segments[0] === "sessions"
            ? [
                {
                  root: baseSessionsDir,
                  target: path.resolve(baseSessionsDir, ...segments.slice(1)),
                },
              ]
            : [
                {
                  root: baseSessionsDir,
                  target: path.resolve(baseSessionsDir, ...segments),
                },
                {
                  root: dataDir,
                  target: path.resolve(dataDir, ...segments),
                },
                ...(segments[0] === "slices"
                  ? [
                      {
                        root: dataDir,
                        target: path.resolve(dataDir, "outputs", ...segments),
                      },
                    ]
                  : []),
              ];

        for (const candidate of candidates) {
          if (isPathInside(candidate.root, candidate.target) && fs.existsSync(candidate.target)) {
            return candidate.target;
          }
        }
        throw new Error("Media file not found or path is outside allowed directories");
      },
      catch: (cause) =>
        new StorageError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    });

  return {
    baseSessionsDir,
    dataDir,
    sanitizeSessionId,
    getSessionPaths,
    resolveSafePath,
  };
};

export const MediaStorageLive = Layer.succeed(MediaStorage, makeMediaStorage());
