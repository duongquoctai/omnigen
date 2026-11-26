import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { Context, Effect, Layer } from "effect";

import type { ProjectId, UserId } from "@/contexts/shared-kernel";
import { NotFoundError, PersistenceError } from "@/platform/errors";
import { SqlClient } from "@/platform/sql";

const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "data", "sqlitecloud_local.json");

interface LocalParentProject {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
}

interface LocalDbJson {
  parentProjects?: Record<string, LocalParentProject>;
  projects?: Record<string, { parentProjectId?: string }>;
  [key: string]: unknown;
}

const readLocalDb = (): LocalDbJson => {
  if (!fs.existsSync(LOCAL_FALLBACK_FILE)) return {};
  return JSON.parse(fs.readFileSync(LOCAL_FALLBACK_FILE, "utf8")) as LocalDbJson;
};

const writeLocalDb = (data: LocalDbJson): void => {
  fs.mkdirSync(path.dirname(LOCAL_FALLBACK_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(data, null, 2), "utf8");
};

export interface ProjectSummary {
  readonly id: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly ownerId: UserId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectRepoValue {
  readonly create: (params: {
    readonly name: string;
    readonly description: string;
    readonly ownerId: UserId;
  }) => Effect.Effect<ProjectSummary, PersistenceError>;
  readonly rename: (params: {
    readonly id: ProjectId;
    readonly name: string;
    readonly description?: string | undefined;
  }) => Effect.Effect<void, PersistenceError | NotFoundError>;
  readonly remove: (id: ProjectId) => Effect.Effect<void, PersistenceError>;
}

export const ProjectRepoTag = Context.Service<ProjectRepoValue>("workspace/ProjectRepo");

export const ProjectRepoLive = Layer.effect(
  ProjectRepoTag,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      create: ({ name, description, ownerId }) => {
        const id = `pproj_${crypto.randomUUID().slice(0, 8)}` as ProjectId;
        const now = new Date().toISOString();
        return sql.isCloud
          ? sql.execute`
                INSERT INTO lachvid_parent_projects (id, name, description, owner_id, created_at, updated_at)
                VALUES (${id}, ${name}, ${description}, ${ownerId}, ${now}, ${now})
              `.pipe(
              Effect.as({
                id,
                name,
                description,
                ownerId,
                createdAt: now,
                updatedAt: now,
              }),
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const parentProjects = db.parentProjects ?? {};
                parentProjects[id] = {
                  id,
                  name,
                  description,
                  ownerId,
                  createdAt: now,
                  updatedAt: now,
                };
                writeLocalDb({ ...db, parentProjects });
                return {
                  id,
                  name,
                  description,
                  ownerId,
                  createdAt: now,
                  updatedAt: now,
                };
              },
              catch: (cause) =>
                new PersistenceError({
                  message: cause instanceof Error ? cause.message : String(cause),
                  cause,
                }),
            });
      },
      rename: ({ id, name, description }) => {
        const now = new Date().toISOString();
        return sql.isCloud
          ? description !== undefined
            ? sql.execute`
                UPDATE lachvid_parent_projects
                SET name = ${name}, description = ${description}, updated_at = ${now}
                WHERE id = ${id}
              `
            : sql.execute`
                UPDATE lachvid_parent_projects
                SET name = ${name}, updated_at = ${now}
                WHERE id = ${id}
              `
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const parentProjects = db.parentProjects ?? {};
                const target = Object.entries(parentProjects).find(([k]) => k === id)?.[1];
                if (!target) {
                  throw new Error("NOT_FOUND");
                }
                parentProjects[id] = {
                  ...target,
                  name,
                  ...(description !== undefined ? { description } : {}),
                  updatedAt: now,
                };
                writeLocalDb({ ...db, parentProjects });
              },
              catch: (cause) =>
                cause instanceof Error && cause.message === "NOT_FOUND"
                  ? new NotFoundError({
                      resource: "Project",
                      id,
                      message: "Không tìm thấy dự án.",
                    })
                  : new PersistenceError({
                      message: cause instanceof Error ? cause.message : String(cause),
                      cause,
                    }),
            });
      },
      remove: (id) =>
        sql.isCloud
          ? Effect.gen(function* () {
              yield* sql.execute`DELETE FROM lachvid_projects WHERE parent_project_id = ${id}`;
              yield* sql.execute`DELETE FROM lachvid_parent_projects WHERE id = ${id}`;
            })
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const restParents = Object.fromEntries(
                  Object.entries(db.parentProjects ?? {}).filter(([k]) => k !== id),
                );
                const remainingFolders = Object.fromEntries(
                  Object.entries(db.projects ?? {}).filter(
                    ([, folder]) => folder.parentProjectId !== id,
                  ),
                );
                writeLocalDb({
                  ...db,
                  parentProjects: restParents,
                  projects: remainingFolders,
                });
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
