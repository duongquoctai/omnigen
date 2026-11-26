import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { vi } from "vitest";

import type { ProjectId, UserId } from "@/contexts/shared-kernel";
import { makeSqlClientFromDatabase, SqlClient } from "@/platform/sql";

import { ProjectRepoLive, ProjectRepoTag } from "../project-repo";

describe("workspace/adapters/project-repo", () => {
  it.effect("creates, renames, and removes projects in cloud SQL mode", () => {
    const sqlMock = vi.fn().mockResolvedValue([]);
    const SqlLayer = Layer.succeed(SqlClient, makeSqlClientFromDatabase({ sql: sqlMock }));

    return Effect.gen(function* () {
      const repo = yield* ProjectRepoTag;
      const created = yield* repo.create({
        name: "Skin1004",
        description: "Campaign",
        ownerId: "u1" as UserId,
      });
      expect(created.name).toBe("Skin1004");

      yield* repo.rename({ id: created.id, name: "Skin1004 v2" });
      yield* repo.remove("p1" as ProjectId);
      expect(sqlMock).toHaveBeenCalledTimes(4);
    }).pipe(Effect.provide(ProjectRepoLive.pipe(Layer.provide(SqlLayer))));
  });
});
