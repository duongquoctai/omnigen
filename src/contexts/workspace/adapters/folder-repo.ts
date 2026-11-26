import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { Context, Effect, Layer } from "effect";

import type { FolderId, ProjectId } from "@/contexts/shared-kernel";
import { NotFoundError, PersistenceError } from "@/platform/errors";
import { SqlClient } from "@/platform/sql";

const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "data", "sqlitecloud_local.json");

interface LocalFolderRow {
  id: string;
  parentProjectId?: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface LocalDbJson {
  projects?: Record<string, LocalFolderRow>;
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

export interface FolderSummary {
  readonly id: FolderId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FolderRepoValue {
  readonly create: (params: {
    readonly projectId: ProjectId;
    readonly name: string;
    readonly description: string;
  }) => Effect.Effect<FolderSummary, PersistenceError>;
  readonly rename: (params: {
    readonly id: FolderId;
    readonly name: string;
  }) => Effect.Effect<void, PersistenceError | NotFoundError>;
  readonly remove: (id: FolderId) => Effect.Effect<void, PersistenceError>;
}

export const FolderRepoTag = Context.Service<FolderRepoValue>("workspace/FolderRepo");

export const FolderRepoLive = Layer.effect(
  FolderRepoTag,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      create: ({ projectId, name, description }) => {
        const id = `fld_${crypto.randomUUID().slice(0, 8)}` as FolderId;
        const now = new Date().toISOString();
        return sql.isCloud
          ? sql.execute`
                INSERT INTO lachvid_projects (id, parent_project_id, name, description, created_at, updated_at)
                VALUES (${id}, ${projectId}, ${name}, ${description}, ${now}, ${now})
              `.pipe(
              Effect.as({
                id,
                projectId,
                name,
                description,
                createdAt: now,
                updatedAt: now,
              }),
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const projects = db.projects ?? {};
                projects[id] = {
                  id,
                  parentProjectId: projectId,
                  name,
                  description,
                  createdAt: now,
                  updatedAt: now,
                };
                writeLocalDb({ ...db, projects });
                return {
                  id,
                  projectId,
                  name,
                  description,
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
      rename: ({ id, name }) => {
        const now = new Date().toISOString();
        return sql.isCloud
          ? sql.execute`
              UPDATE lachvid_projects
              SET name = ${name}, updated_at = ${now}
              WHERE id = ${id}
            `
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const projects = db.projects ?? {};
                const target = Object.entries(projects).find(([k]) => k === id)?.[1];
                if (!target) {
                  throw new Error("NOT_FOUND");
                }
                projects[id] = { ...target, name, updatedAt: now };
                writeLocalDb({ ...db, projects });
              },
              catch: (cause) =>
                cause instanceof Error && cause.message === "NOT_FOUND"
                  ? new NotFoundError({
                      resource: "Folder",
                      id,
                      message: "Không tìm thấy thư mục.",
                    })
                  : new PersistenceError({
                      message: cause instanceof Error ? cause.message : String(cause),
                      cause,
                    }),
            });
      },
      remove: (id) =>
        sql.isCloud
          ? sql.execute`DELETE FROM lachvid_projects WHERE id = ${id}`
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const rest = Object.fromEntries(
                  Object.entries(db.projects ?? {}).filter(([k]) => k !== id),
                );
                writeLocalDb({ ...db, projects: rest });
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
