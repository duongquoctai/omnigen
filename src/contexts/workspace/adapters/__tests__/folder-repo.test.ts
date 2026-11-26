import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { vi } from "vitest";

import type { FolderId, ProjectId } from "@/contexts/shared-kernel";
import { makeSqlClientFromDatabase, SqlClient } from "@/platform/sql";

import { FolderRepoLive, FolderRepoTag } from "../folder-repo";

describe("workspace/adapters/folder-repo", () => {
  it.effect("creates, renames, and removes folders in cloud SQL mode", () => {
    const sqlMock = vi.fn().mockResolvedValue([]);
    const SqlLayer = Layer.succeed(SqlClient, makeSqlClientFromDatabase({ sql: sqlMock }));

    return Effect.gen(function* () {
      const repo = yield* FolderRepoTag;
      const created = yield* repo.create({
        projectId: "p1" as ProjectId,
        name: "Folder A",
        description: "Desc",
      });
      expect(created.name).toBe("Folder A");

      yield* repo.rename({ id: created.id, name: "Folder B" });
      yield* repo.remove("fld_1" as FolderId);
      expect(sqlMock).toHaveBeenCalledTimes(3);
    }).pipe(Effect.provide(FolderRepoLive.pipe(Layer.provide(SqlLayer))));
  });
});
