import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { vi } from "vitest";

import { AppConfig } from "@/platform/config";
import { SqlClient } from "@/platform/sql";

import { DEFAULT_MODULE_PERMISSIONS } from "../../domain/sharing";
import { CurrentUserPort, ShareRepo } from "../../workflows/ports";
import { CurrentUserLive, ShareRepoLive } from "../share-repo";

const fsStore = vi.hoisted(() => ({
  content: JSON.stringify({
    parentProjects: { proj_1: { id: "proj_1", ownerId: "u_owner" } },
    users: {
      u_member: { id: "u_member", email: "member@example.com", name: "Member" },
    },
    shares: {},
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

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: () => undefined,
    }),
  ),
}));

describe("access/adapters/ShareRepoLive", () => {
  it.effect("checks ownership, lists, upserts, and removes shares via SqlClient", () => {
    const queries: Array<string> = [];
    const mockSql = Layer.succeed(SqlClient, {
      isCloud: true,
      query: (strings) => {
        const sql = strings.join("?");
        queries.push(sql);
        if (sql.includes("FROM lachvid_parent_projects")) {
          expect(sql).toContain("SELECT owner_id");
          return Effect.succeed([{ owner_id: "u_owner" }]);
        }
        if (sql.includes("FROM lachvid_resource_shares s")) {
          return Effect.succeed([
            {
              id: "shr_1",
              resource_id: "proj_1",
              shared_with_email: "member@example.com",
              shared_with_user_id: "u_member",
              shared_user_name: "Member",
              permissions: JSON.stringify({
                split: { enabled: true, actions: ["view", "export"] },
              }),
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ]);
        }
        if (sql.includes("FROM lachvid_users WHERE lower(email)")) {
          return Effect.succeed([{ id: "u_member", name: "Member" }]);
        }
        if (sql.includes("SELECT id, created_at FROM lachvid_resource_shares")) {
          return Effect.succeed([]);
        }
        if (sql.includes("SELECT id FROM lachvid_resource_shares")) {
          return Effect.succeed([{ id: "shr_1" }]);
        }
        if (sql.includes("SELECT id, email, name FROM lachvid_users")) {
          return Effect.succeed([{ id: "u_member", email: "member@example.com", name: "Member" }]);
        }
        return Effect.succeed([]);
      },
      execute: () => Effect.succeed([]),
    });

    const layer = ShareRepoLive.pipe(Layer.provide(mockSql));

    return Effect.gen(function* () {
      const repo = yield* ShareRepo;
      expect(yield* repo.isProjectOwner("proj_1", "u_owner")).toBe(true);
      expect(yield* repo.isProjectOwner("proj_1", "u_other")).toBe(false);

      const shares = yield* repo.listShares("proj_1");
      expect(shares).toHaveLength(1);
      expect(shares[0]?.sharedUserName).toBe("Member");

      const created = yield* repo.upsertShare({
        ownerId: "u_owner",
        projectId: "proj_1",
        targetEmail: "member@example.com",
        permissions: DEFAULT_MODULE_PERMISSIONS,
      });
      expect(created.sharedWithUserId).toBe("u_member");

      const users = yield* repo.listShareableUsers();
      expect(users).toHaveLength(1);

      const removed = yield* repo.removeShare("shr_1", "u_owner");
      expect(removed).toBe(true);
      expect(queries.some((q) => q.includes("INSERT INTO lachvid_resource_shares"))).toBe(true);
      expect(queries.some((q) => q.includes("DELETE FROM lachvid_resource_shares"))).toBe(true);
    }).pipe(Effect.provide(layer));
  });

  it.effect(
    "updates existing share in SQL mode and handles missing cookie in CurrentUserLive",
    () => {
      const queries: Array<string> = [];
      const mockSql = Layer.succeed(SqlClient, {
        isCloud: true,
        query: (strings) => {
          const sql = strings.join("?");
          queries.push(sql);
          if (sql.includes("FROM lachvid_users WHERE lower(email)")) {
            return Effect.succeed([{ id: "u_member", name: "Member" }]);
          }
          if (sql.includes("SELECT id, created_at FROM lachvid_resource_shares")) {
            return Effect.succeed([{ id: "shr_existing", created_at: "2026-01-01T00:00:00.000Z" }]);
          }
          return Effect.succeed([]);
        },
        execute: () => Effect.succeed([]),
      });

      const configLayer = Layer.succeed(AppConfig, {
        authSecret: "test-secret",
      } as never);

      const layer = Layer.mergeAll(
        ShareRepoLive.pipe(Layer.provide(mockSql)),
        CurrentUserLive.pipe(Layer.provide(configLayer)),
      );

      return Effect.gen(function* () {
        const repo = yield* ShareRepo;
        const updated = yield* repo.upsertShare({
          ownerId: "u_owner",
          projectId: "proj_1",
          targetEmail: "member@example.com",
          permissions: DEFAULT_MODULE_PERMISSIONS,
        });
        expect(updated.id).toBe("shr_existing");
        expect(queries.some((q) => q.includes("UPDATE lachvid_resource_shares"))).toBe(true);

        const userPort = yield* CurrentUserPort;
        const currentUser = yield* userPort.getCurrentUser();
        expect(Option.isNone(currentUser)).toBe(true);
      }).pipe(Effect.provide(layer));
    },
  );

  it.effect("supports local JSON fallback when isCloud is false", () => {
    const localSql = Layer.succeed(SqlClient, {
      isCloud: false,
      query: () => Effect.succeed([]),
      execute: () => Effect.succeed([]),
    });
    const layer = ShareRepoLive.pipe(Layer.provide(localSql));

    return Effect.gen(function* () {
      const repo = yield* ShareRepo;
      expect(yield* repo.isProjectOwner("proj_1", "u_owner")).toBe(true);

      const created = yield* repo.upsertShare({
        ownerId: "u_owner",
        projectId: "proj_1",
        targetEmail: "member@example.com",
        permissions: DEFAULT_MODULE_PERMISSIONS,
      });
      expect(created.sharedWithUserId).toBe("u_member");

      const shares = yield* repo.listShares("proj_1");
      expect(shares).toHaveLength(1);

      const users = yield* repo.listShareableUsers();
      expect(users).toHaveLength(1);

      const removed = yield* repo.removeShare(created.id, "u_owner");
      expect(removed).toBe(true);
    }).pipe(Effect.provide(layer));
  });
});
