import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Effect, Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeMediaStorage, MediaStorage } from "@/platform/storage/media-storage";

import { DEFAULT_MIN_DURATIONS } from "../../domain/shot";
import { FootageRepo, ShotIdGenerator } from "../../workflows/ports";
import { SessionFootageRepoLive, ShotIdGeneratorLive } from "../session-footage-repo";
import { shotFromLegacyDto } from "../shot-dto";

describe("footage/adapters/session-footage-repo", () => {
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lachvid-footage-repo-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves shots and reads sourceVideo from session state file", async () => {
    const storage = makeMediaStorage({
      baseSessionsDir: path.join(tmpDir, "sessions"),
      dataDir: path.join(tmpDir, "data"),
    });
    const StorageLayer = Layer.succeed(MediaStorage, storage);
    const RepoLayer = SessionFootageRepoLive.pipe(Layer.provide(StorageLayer));

    const paths = storage.getSessionPaths("sess_1");
    fs.mkdirSync(paths.root, { recursive: true });
    fs.writeFileSync(
      path.join(paths.root, "project_state.json"),
      JSON.stringify({
        sourceVideo: {
          id: "src_1",
          name: "demo.mp4",
          fileName: "demo.mp4",
          localUrl: "/api/media/sessions/sess_1/source/demo.mp4",
          localPath: "/tmp/demo.mp4",
          sizeBytes: 100,
          duration: 12,
          width: 1080,
          height: 1920,
          createdAt: "2026-11-17T00:00:00Z",
        },
        shots: [],
      }),
    );

    const shot = shotFromLegacyDto({
      id: "s1",
      sourceVideoId: "src_1",
      label: "Open #1",
      begin: 0,
      end: 6,
      category: "open",
      edits: { flipH: false, speed: 1, zoom: false },
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* FootageRepo;
        const idGen = yield* ShotIdGenerator;
        const src = yield* repo.getSourceVideo("sess_1");
        expect(src.id).toBe("src_1");
        expect(idGen.makeId("fld_1", 0)).toContain("shot_pyscene_1_");

        if (shot._tag === "ClassifiedShot") {
          yield* repo.saveShots("sess_1", [shot], DEFAULT_MIN_DURATIONS);
        }
      }).pipe(Effect.provide(Layer.mergeAll(RepoLayer, ShotIdGeneratorLive))),
    );

    const saved = JSON.parse(
      fs.readFileSync(path.join(paths.root, "project_state.json"), "utf8"),
    ) as { shots: unknown[] };
    expect(saved.shots).toHaveLength(1);
  });

  it("fails with StorageError when session file is missing", async () => {
    const storage = makeMediaStorage({
      baseSessionsDir: path.join(tmpDir, "sessions"),
      dataDir: path.join(tmpDir, "data"),
    });
    const RepoLayer = SessionFootageRepoLive.pipe(
      Layer.provide(Layer.succeed(MediaStorage, storage)),
    );

    const err = await Effect.runPromise(
      Effect.flip(
        Effect.gen(function* () {
          const repo = yield* FootageRepo;
          return yield* repo.getSourceVideo("missing_sess");
        }).pipe(Effect.provide(RepoLayer)),
      ),
    );
    expect(err._tag).toBe("StorageError");
  });
});
