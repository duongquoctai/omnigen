import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { vi } from "vitest";

import { SqlClient } from "@/platform/sql";

import type { RenderedRecordId } from "../../domain/types";
import { RenderedHistoryRepo } from "../../workflows/ports";
import { RenderedHistoryRepoLive } from "../rendered-history-repo";

const fsStore = vi.hoisted(() => ({
  content: JSON.stringify({
    renderedVideos: {
      fld_1: [
        {
          id: "rec_1",
          projectId: "fld_1",
          name: "Mix #1",
          tupleKey: "a|b|c|d|e",
          outputUrl: "/api/media/out.mp4",
          used: false,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  }),
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

describe("rendering/adapters/RenderedHistoryRepoLive", () => {
  it.effect("finds, updates status, and removes rendered records in local fallback", () => {
    const localSql = Layer.succeed(SqlClient, {
      isCloud: false,
      query: () => Effect.succeed([]),
      execute: () => Effect.succeed([]),
    });

    const layer = RenderedHistoryRepoLive.pipe(Layer.provide(localSql));

    return Effect.gen(function* () {
      const repo = yield* RenderedHistoryRepo;
      const found = yield* repo.findById("rec_1" as RenderedRecordId);
      expect(found.status).toBe("unused");

      yield* repo.updateStatus("rec_1" as RenderedRecordId, "used");
      const updated = yield* repo.findById("rec_1" as RenderedRecordId);
      expect(updated.status).toBe("used");

      yield* repo.remove("rec_1" as RenderedRecordId);
      const err = yield* repo.findById("rec_1" as RenderedRecordId).pipe(Effect.flip);
      expect(err._tag).toBe("RecordNotFound");
    }).pipe(Effect.provide(layer));
  });
});
