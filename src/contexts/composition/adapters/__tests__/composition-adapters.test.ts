import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { vi } from "vitest";

import { ClipId, FolderId, MediaUrl, Seconds, VoiceId } from "@/contexts/shared-kernel";
import { SqlClient } from "@/platform/sql";

import type { Clip, DriveFileId, VoiceClip } from "../../domain/types";
import { ClipLibraryRepo, DriveMediaGateway, VoiceLibraryRepo } from "../../workflows/ports";
import { DriveMediaGatewayLive } from "../drive-gateway";
import { ClipLibraryRepoLive } from "../library-repo";
import { VoiceLibraryRepoLive } from "../voice-repo";

const fsStore = vi.hoisted(() => ({
  content: JSON.stringify({ pools: {}, voices: {} }),
}));

vi.mock("node:fs", () => ({
  default: {
    existsSync: () => true,
    readFileSync: () => fsStore.content,
    mkdirSync: () => undefined,
    writeFileSync: (_file: string, data: string) => {
      fsStore.content = data;
    },
  },
}));

describe("composition/adapters", () => {
  it.effect("reads and writes clips & voices in local fallback mode", () => {
    const localSql = Layer.succeed(SqlClient, {
      isCloud: false,
      query: () => Effect.succeed([]),
      execute: () => Effect.succeed([]),
    });

    const layer = Layer.mergeAll(
      ClipLibraryRepoLive.pipe(Layer.provide(localSql)),
      VoiceLibraryRepoLive.pipe(Layer.provide(localSql)),
    );

    const folderId = "fld_1" as FolderId;
    const clip: Clip = {
      id: "c1" as ClipId,
      name: "Open #1",
      fileName: "open.mp4",
      category: "open",
      duration: 4 as Seconds,
      source: {
        _tag: "DriveClip",
        fileId: "1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345" as DriveFileId,
        streamUrl: "/api/drive-stream/1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345" as MediaUrl,
      },
      lockFlipH: false,
      contentHash: Option.none(),
    };
    const voice: VoiceClip = {
      id: "v1" as VoiceId,
      name: "Voice #1",
      fileName: "v1.mp3",
      localUrl: "/api/drive-stream/v1" as MediaUrl,
      localPath: Option.none(),
      duration: 12 as Seconds,
    };

    return Effect.gen(function* () {
      const clipRepo = yield* ClipLibraryRepo;
      const voiceRepo = yield* VoiceLibraryRepo;

      yield* clipRepo.addClips(folderId, [clip]);
      const lib = yield* clipRepo.get(folderId);
      expect(lib.open).toHaveLength(1);

      yield* clipRepo.removeClip(folderId, clip.id);
      expect((yield* clipRepo.get(folderId)).open).toHaveLength(0);

      yield* clipRepo.addClips(folderId, [clip]);
      yield* clipRepo.clearCategory(folderId, "open");
      expect((yield* clipRepo.get(folderId)).open).toHaveLength(0);

      yield* voiceRepo.addVoices(folderId, [voice]);
      expect(yield* voiceRepo.list(folderId)).toHaveLength(1);
      yield* voiceRepo.removeVoice(folderId, voice.id);
      expect(yield* voiceRepo.list(folderId)).toHaveLength(0);
    }).pipe(Effect.provide(layer));
  });

  it.effect("probes drive metadata with fallback on network failure", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline"));

    return Effect.gen(function* () {
      const gateway = yield* DriveMediaGateway;
      const probed = yield* gateway.probeClip("1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345" as DriveFileId);
      expect(probed.duration).toBe(4);
      expect(probed.lockFlipH).toBe(false);
      expect(Option.isNone(probed.contentHash)).toBe(true);
      expect(probed.streamUrl).toBe("/api/drive-stream/1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345");
      fetchSpy.mockRestore();
    }).pipe(Effect.provide(DriveMediaGatewayLive));
  });

  it.effect("detects _lock in filename and computes 16-char md5 contentHash", () => {
    const payload = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(payload, {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-disposition": 'attachment; filename="01_open_LOCK.mp4"',
          "content-range": "bytes 0-7/1024",
        },
      }),
    );

    return Effect.gen(function* () {
      const gateway = yield* DriveMediaGateway;
      const probed = yield* gateway.probeClip("9zYxWvUtSrQpOnMlKjIhGfEdCbA54321" as DriveFileId);
      expect(probed.name).toBe("01_open_LOCK");
      expect(probed.lockFlipH).toBe(true);
      expect(Option.isSome(probed.contentHash)).toBe(true);
      if (Option.isSome(probed.contentHash)) {
        expect(probed.contentHash.value).toMatch(/^[a-f0-9]{16}$/);
      }
      fetchSpy.mockRestore();
    }).pipe(Effect.provide(DriveMediaGatewayLive));
  });
});
