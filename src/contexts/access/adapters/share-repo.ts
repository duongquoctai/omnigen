import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { Effect, Layer, Option } from "effect";
import { cookies } from "next/headers";

import { UserId } from "@/contexts/shared-kernel";
import { AppConfig } from "@/platform/config";
import { PersistenceError } from "@/platform/errors";
import { SqlClient } from "@/platform/sql";

import type { TokenPayload } from "../domain/auth";
import {
  type LegacySharePermissionsShape,
  modulePermissionsFromLegacy,
  modulePermissionsToLegacy,
  type ProjectShareItem,
  type ShareableUser,
} from "../domain/sharing";
import { CurrentUserPort, ShareRepo } from "../workflows/ports";
import { verifySessionToken } from "./token-verifier";

const AUTH_COOKIE_NAME = "lachvid_token";
const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "data", "sqlitecloud_local.json");

interface LocalParentProjectRow {
  id: string;
  userId?: string | null;
}

interface LocalUserRow {
  id: string;
  email: string;
  name: string;
}

interface LocalShareRow {
  id: string;
  resourceType: "project" | "folder";
  resourceId: string;
  ownerId: string;
  sharedWithEmail: string;
  sharedWithUserId?: string | null;
  permissions: LegacySharePermissionsShape;
  createdAt: string;
  updatedAt: string;
}

interface LocalDbJson {
  parentProjects?: Record<string, LocalParentProjectRow | undefined>;
  users?: Record<string, LocalUserRow | undefined>;
  shares?: Record<string, LocalShareRow | undefined>;
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

const decodeTokenPayload = (token: string): Option.Option<TokenPayload> => {
  try {
    const payloadB64 = token.split(".")[0];
    if (!payloadB64) return Option.none();
    const normalized = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(
      Buffer.from(normalized, "base64").toString("utf8"),
    ) as Partial<TokenPayload>;
    if (
      typeof parsed.userId === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.exp === "number"
    ) {
      return Option.some({
        userId: parsed.userId,
        email: parsed.email,
        name: parsed.name,
        exp: parsed.exp,
      });
    }
    return Option.none();
  } catch {
    return Option.none();
  }
};

const parsePermissionsJson = (raw: unknown): LegacySharePermissionsShape => {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw) as LegacySharePermissionsShape;
  } catch {
    return {};
  }
};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

export const CurrentUserLive = Layer.effect(
  CurrentUserPort,
  Effect.gen(function* () {
    const config = yield* AppConfig;

    return {
      getCurrentUser: () =>
        Effect.gen(function* () {
          const cookieStore = yield* Effect.tryPromise({
            try: () => cookies(),
            catch: () => new Error("cookies unavailable"),
          }).pipe(Effect.orElseSucceed(() => null));
          const token = cookieStore?.get(AUTH_COOKIE_NAME)?.value;
          if (!token) return Option.none();

          const isValid = yield* verifySessionToken({
            token,
            secret: config.authSecret,
            nowEpochSec: Math.floor(Date.now() / 1000),
          });
          if (!isValid) return Option.none();

          return decodeTokenPayload(token).pipe(
            Option.map((payload) => ({
              id: UserId.make(payload.userId),
              email: payload.email,
              name: payload.name,
            })),
          );
        }),
    };
  }),
);

export const ShareRepoLive = Layer.effect(
  ShareRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      isProjectOwner: (projectId, userId) =>
        sql.isCloud
          ? sql.query`SELECT user_id FROM lachvid_parent_projects WHERE id = ${projectId} LIMIT 1`.pipe(
              Effect.map((rows) => {
                const row = rows.at(0);
                if (!row) return false;
                const ownerId = asNullableString(row.user_id);
                return ownerId === null || ownerId === userId;
              }),
            )
          : Effect.try({
              try: () => {
                const project = readLocalDb().parentProjects?.[projectId];
                return Boolean(project && (!project.userId || project.userId === userId));
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không kiểm tra được quyền sở hữu dự án",
                  cause,
                }),
            }),

      listShares: (projectId) =>
        sql.isCloud
          ? sql.query`SELECT s.id, s.resource_id, s.shared_with_email, s.shared_with_user_id, u.name AS shared_user_name, s.permissions, s.created_at, s.updated_at FROM lachvid_resource_shares s LEFT JOIN lachvid_users u ON s.shared_with_user_id = u.id WHERE s.resource_type = 'project' AND s.resource_id = ${projectId} ORDER BY s.created_at DESC`.pipe(
              Effect.map((rows) =>
                rows.map((row): ProjectShareItem => ({
                  id: asString(row.id),
                  projectId: asString(row.resource_id),
                  sharedWithEmail: asString(row.shared_with_email),
                  sharedWithUserId: asNullableString(row.shared_with_user_id),
                  sharedUserName: asNullableString(row.shared_user_name),
                  permissions: modulePermissionsFromLegacy(parsePermissionsJson(row.permissions)),
                  createdAt: asString(row.created_at),
                  updatedAt: asString(row.updated_at),
                })),
              ),
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const usersById = db.users ?? {};
                return Object.values(db.shares ?? {})
                  .filter(
                    (s): s is LocalShareRow =>
                      Boolean(s) && s?.resourceType === "project" && s.resourceId === projectId,
                  )
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((s): ProjectShareItem => ({
                    id: s.id,
                    projectId: s.resourceId,
                    sharedWithEmail: s.sharedWithEmail,
                    sharedWithUserId: s.sharedWithUserId ?? null,
                    sharedUserName: s.sharedWithUserId
                      ? (usersById[s.sharedWithUserId]?.name ?? null)
                      : null,
                    permissions: modulePermissionsFromLegacy(s.permissions),
                    createdAt: s.createdAt,
                    updatedAt: s.updatedAt,
                  }));
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể tải danh sách chia sẻ dự án",
                  cause,
                }),
            }),

      upsertShare: ({ ownerId, projectId, targetEmail, permissions }) =>
        Effect.gen(function* () {
          const now = new Date().toISOString();
          const legacyPerms = modulePermissionsToLegacy(permissions);

          if (!sql.isCloud) {
            return yield* Effect.try({
              try: () => {
                const db = readLocalDb();
                const matchedUser = Object.values(db.users ?? {}).find(
                  (u): u is LocalUserRow => Boolean(u) && u?.email.toLowerCase() === targetEmail,
                );
                const shares = { ...(db.shares ?? {}) };
                const existing = Object.values(shares).find(
                  (s): s is LocalShareRow =>
                    Boolean(s) &&
                    s?.resourceType === "project" &&
                    s.resourceId === projectId &&
                    s.sharedWithEmail.toLowerCase() === targetEmail,
                );
                const id = existing?.id ?? `shr_${crypto.randomBytes(6).toString("hex")}`;
                const createdAt = existing?.createdAt ?? now;
                const sharedWithUserId = matchedUser?.id ?? existing?.sharedWithUserId ?? null;

                shares[id] = {
                  id,
                  resourceType: "project",
                  resourceId: projectId,
                  ownerId,
                  sharedWithEmail: targetEmail,
                  sharedWithUserId,
                  permissions: legacyPerms,
                  createdAt,
                  updatedAt: now,
                };
                writeLocalDb({ ...db, shares });

                return {
                  id,
                  projectId,
                  sharedWithEmail: targetEmail,
                  sharedWithUserId,
                  sharedUserName: matchedUser?.name ?? null,
                  permissions,
                  createdAt,
                  updatedAt: now,
                } satisfies ProjectShareItem;
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể lưu quyền chia sẻ",
                  cause,
                }),
            });
          }

          const userRows =
            yield* sql.query`SELECT id, name FROM lachvid_users WHERE lower(email) = lower(${targetEmail}) LIMIT 1`;
          const matchedUser = userRows.at(0);
          const matchedUserId = asNullableString(matchedUser?.id);
          const matchedUserName = asNullableString(matchedUser?.name);

          const existingRows =
            yield* sql.query`SELECT id, created_at FROM lachvid_resource_shares WHERE resource_type = 'project' AND resource_id = ${projectId} AND lower(shared_with_email) = lower(${targetEmail}) LIMIT 1`;
          const existing = existingRows.at(0);
          const permsStr = JSON.stringify(legacyPerms);

          if (existing) {
            const existingId = asString(existing.id);
            const createdAt = asString(existing.created_at, now);
            yield* sql.query`UPDATE lachvid_resource_shares SET permissions = ${permsStr}, shared_with_user_id = ${matchedUserId}, updated_at = ${now} WHERE id = ${existingId}`;
            return {
              id: existingId,
              projectId,
              sharedWithEmail: targetEmail,
              sharedWithUserId: matchedUserId,
              sharedUserName: matchedUserName,
              permissions,
              createdAt,
              updatedAt: now,
            } satisfies ProjectShareItem;
          }

          const id = `shr_${crypto.randomBytes(6).toString("hex")}`;
          yield* sql.query`INSERT INTO lachvid_resource_shares (id, resource_type, resource_id, owner_id, shared_with_email, shared_with_user_id, permissions, created_at, updated_at) VALUES (${id}, 'project', ${projectId}, ${ownerId}, ${targetEmail}, ${matchedUserId}, ${permsStr}, ${now}, ${now})`;

          return {
            id,
            projectId,
            sharedWithEmail: targetEmail,
            sharedWithUserId: matchedUserId,
            sharedUserName: matchedUserName,
            permissions,
            createdAt: now,
            updatedAt: now,
          } satisfies ProjectShareItem;
        }),

      removeShare: (shareId, ownerId) =>
        sql.isCloud
          ? Effect.gen(function* () {
              const existing =
                yield* sql.query`SELECT id FROM lachvid_resource_shares WHERE id = ${shareId} AND owner_id = ${ownerId} LIMIT 1`;
              if (existing.length === 0) return false;
              yield* sql.query`DELETE FROM lachvid_resource_shares WHERE id = ${shareId} AND owner_id = ${ownerId}`;
              return true;
            })
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const shares = { ...(db.shares ?? {}) };
                const existing = shares[shareId];
                if (!existing || (existing.ownerId && existing.ownerId !== ownerId)) {
                  return false;
                }
                const rest = Object.fromEntries(
                  Object.entries(shares).filter(([key]) => key !== shareId),
                );
                writeLocalDb({ ...db, shares: rest });
                return true;
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể thu hồi quyền chia sẻ",
                  cause,
                }),
            }),

      listShareableUsers: () =>
        sql.isCloud
          ? sql.query`SELECT id, email, name FROM lachvid_users ORDER BY name ASC`.pipe(
              Effect.map((rows) =>
                rows.map((row): ShareableUser => ({
                  id: asString(row.id),
                  email: asString(row.email),
                  name: asString(row.name),
                })),
              ),
            )
          : Effect.try({
              try: () =>
                Object.values(readLocalDb().users ?? {})
                  .filter((u): u is LocalUserRow => Boolean(u))
                  .map((u): ShareableUser => ({
                    id: u.id,
                    email: u.email,
                    name: u.name,
                  })),
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể tải danh sách thành viên",
                  cause,
                }),
            }),
    };
  }),
);
