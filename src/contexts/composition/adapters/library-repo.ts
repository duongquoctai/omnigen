import "server-only";

import fs from "node:fs";
import path from "node:path";

import { Effect, Layer, Option } from "effect";

import type {
  ClipId,
  ContentHash,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
} from "@/contexts/shared-kernel";
import { PersistenceError } from "@/platform/errors";
import { SqlClient } from "@/platform/sql";

import type { Clip, ClipLibrary, DriveFileId } from "../domain/types";
import { ClipLibraryRepo, PlannedVideoRepo, RenderedTuplesQuery } from "../workflows/ports";

const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "data", "sqlitecloud_local.json");

interface LocalCategoryItem {
  id: string;
  name: string;
  fileName: string;
  category: ShotCategory;
  duration: number;
  localUrl: string;
  localPath?: string;
  source?: string;
  driveFileId?: string;
  lockFlipH?: boolean;
  contentHash?: string;
}

interface LocalVoiceItem {
  id: string;
  name: string;
  fileName: string;
  localUrl: string;
  localPath?: string;
  duration: number;
}

interface LocalRenderedItem {
  tupleKey?: string;
}

interface LocalDbJson {
  pools?: Record<string, Partial<Record<ShotCategory, Array<LocalCategoryItem>>> | undefined>;
  voices?: Record<string, Array<LocalVoiceItem> | undefined>;
  rendered?: Record<string, Array<LocalRenderedItem> | undefined>;
  renderedVideos?: Record<string, Array<LocalRenderedItem> | undefined>;
  [key: string]: unknown;
}

const emptyLocalPools = (): Record<ShotCategory, Array<LocalCategoryItem>> => ({
  open: [],
  product: [],
  texture: [],
  apply: [],
  end: [],
});

const emptyLibrary = (): ClipLibrary => ({
  open: [],
  product: [],
  texture: [],
  apply: [],
  end: [],
});

const readLocalDb = (): LocalDbJson => {
  if (!fs.existsSync(LOCAL_FALLBACK_FILE)) return {};
  return JSON.parse(fs.readFileSync(LOCAL_FALLBACK_FILE, "utf8")) as LocalDbJson;
};

const writeLocalDb = (data: LocalDbJson): void => {
  fs.mkdirSync(path.dirname(LOCAL_FALLBACK_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(data, null, 2), "utf8");
};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toDomainClip = (row: Record<string, unknown>): Clip => {
  const id = asString(row.id) as ClipId;
  const localUrl = asString(row.local_url ?? row.localUrl) as MediaUrl;
  const localPath = asString(row.local_path ?? row.localPath);
  const driveFileId = asString(row.drive_file_id ?? row.driveFileId);
  const category = (asString(row.category, "open") || "open") as ShotCategory;
  const duration = Math.max(0.1, asNumber(row.duration, 4)) as Seconds;
  const contentHashRaw = asString(row.content_hash ?? row.contentHash);

  const source =
    driveFileId.length > 0
      ? {
          _tag: "DriveClip" as const,
          fileId: driveFileId as DriveFileId,
          streamUrl: localUrl,
        }
      : {
          _tag: "LocalClip" as const,
          localPath: (localPath || localUrl) as LocalPath,
          localUrl,
        };

  return {
    id,
    name: asString(row.name) || "Clip",
    fileName: asString(row.file_name ?? row.fileName) || "clip.mp4",
    category,
    duration,
    source,
    lockFlipH: Boolean(row.lock_flip_h ?? row.lockFlipH),
    contentHash:
      contentHashRaw.length > 0 ? Option.some(contentHashRaw as ContentHash) : Option.none(),
  };
};

const toLocalCategoryItem = (clip: Clip): LocalCategoryItem => {
  const base = {
    id: clip.id,
    name: clip.name,
    fileName: clip.fileName,
    category: clip.category,
    duration: clip.duration,
    lockFlipH: clip.lockFlipH,
    ...(Option.isSome(clip.contentHash) ? { contentHash: clip.contentHash.value } : {}),
  };
  if (clip.source._tag === "DriveClip") {
    return {
      ...base,
      localUrl: clip.source.streamUrl,
      source: "drive",
      driveFileId: clip.source.fileId,
    };
  }
  return {
    ...base,
    localUrl: clip.source.localUrl,
    localPath: clip.source.localPath,
    source: "local",
  };
};

export const ClipLibraryRepoLive = Layer.effect(
  ClipLibraryRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      get: (folderId) =>
        sql.isCloud
          ? sql.query`SELECT id, category, name, file_name, local_url, local_path, duration, drive_file_id, lock_flip_h, content_hash FROM lachvid_category_items WHERE project_id = ${folderId} ORDER BY created_at ASC`.pipe(
              Effect.map((rows) => {
                const grouped: Record<ShotCategory, Array<Clip>> = {
                  open: [],
                  product: [],
                  texture: [],
                  apply: [],
                  end: [],
                };
                for (const row of rows) {
                  const clip = toDomainClip(row);
                  grouped[clip.category].push(clip);
                }
                return grouped satisfies ClipLibrary;
              }),
            )
          : Effect.try({
              try: () => {
                const pools = readLocalDb().pools?.[folderId];
                if (!pools) return emptyLibrary();
                return {
                  open: (pools.open ?? []).map((item) =>
                    toDomainClip(item as unknown as Record<string, unknown>),
                  ),
                  product: (pools.product ?? []).map((item) =>
                    toDomainClip(item as unknown as Record<string, unknown>),
                  ),
                  texture: (pools.texture ?? []).map((item) =>
                    toDomainClip(item as unknown as Record<string, unknown>),
                  ),
                  apply: (pools.apply ?? []).map((item) =>
                    toDomainClip(item as unknown as Record<string, unknown>),
                  ),
                  end: (pools.end ?? []).map((item) =>
                    toDomainClip(item as unknown as Record<string, unknown>),
                  ),
                } satisfies ClipLibrary;
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể tải kho clip theo category",
                  cause,
                }),
            }),

      addClips: (folderId, clips) =>
        sql.isCloud
          ? Effect.forEach(
              clips,
              (clip) => {
                const now = new Date().toISOString();
                const driveId = clip.source._tag === "DriveClip" ? clip.source.fileId : null;
                const sourceType = clip.source._tag === "DriveClip" ? "drive" : "local";
                const localUrl =
                  clip.source._tag === "DriveClip" ? clip.source.streamUrl : clip.source.localUrl;
                const localPath = clip.source._tag === "DriveClip" ? null : clip.source.localPath;
                return sql.query`INSERT OR REPLACE INTO lachvid_category_items (id, project_id, category, name, file_name, local_url, local_path, duration, drive_file_id, source_type, lock_flip_h, content_hash, created_at) VALUES (${clip.id}, ${folderId}, ${clip.category}, ${clip.name}, ${clip.fileName}, ${localUrl}, ${localPath}, ${clip.duration}, ${driveId}, ${sourceType}, ${clip.lockFlipH ? 1 : 0}, ${Option.getOrNull(clip.contentHash)}, ${now})`;
              },
              { discard: true },
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const pools = { ...(db.pools ?? {}) };
                const current = pools[folderId] ?? emptyLocalPools();
                const nextFolder: Record<ShotCategory, Array<LocalCategoryItem>> = {
                  open: [...(current.open ?? [])],
                  product: [...(current.product ?? [])],
                  texture: [...(current.texture ?? [])],
                  apply: [...(current.apply ?? [])],
                  end: [...(current.end ?? [])],
                };
                for (const clip of clips) {
                  const arr = nextFolder[clip.category].filter((item) => item.id !== clip.id);
                  arr.push(toLocalCategoryItem(clip));
                  nextFolder[clip.category] = arr;
                }
                pools[folderId] = nextFolder;
                writeLocalDb({ ...db, pools });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể lưu clip vào kho",
                  cause,
                }),
            }),

      removeClip: (folderId, clipId) =>
        sql.isCloud
          ? sql.query`DELETE FROM lachvid_category_items WHERE project_id = ${folderId} AND id = ${clipId}`.pipe(
              Effect.asVoid,
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const pools = { ...(db.pools ?? {}) };
                const current = pools[folderId];
                if (!current) return;
                pools[folderId] = {
                  open: (current.open ?? []).filter((c) => c.id !== clipId),
                  product: (current.product ?? []).filter((c) => c.id !== clipId),
                  texture: (current.texture ?? []).filter((c) => c.id !== clipId),
                  apply: (current.apply ?? []).filter((c) => c.id !== clipId),
                  end: (current.end ?? []).filter((c) => c.id !== clipId),
                };
                writeLocalDb({ ...db, pools });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể xoá clip khỏi kho",
                  cause,
                }),
            }),

      clearCategory: (folderId, category) =>
        sql.isCloud
          ? sql.query`DELETE FROM lachvid_category_items WHERE project_id = ${folderId} AND category = ${category}`.pipe(
              Effect.asVoid,
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const pools = { ...(db.pools ?? {}) };
                const current = pools[folderId];
                if (!current) return;
                pools[folderId] = { ...current, [category]: [] };
                writeLocalDb({ ...db, pools });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể dọn trống category",
                  cause,
                }),
            }),
    };
  }),
);

export const RenderedTuplesQueryLive = Layer.effect(
  RenderedTuplesQuery,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      forFolder: (folderId) =>
        sql.isCloud
          ? sql.query`SELECT tuple_key FROM lachvid_rendered_history WHERE project_id = ${folderId}`.pipe(
              Effect.map((rows) =>
                rows.map((row) => asString(row.tuple_key)).filter((key) => key.length > 0),
              ),
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const list = db.rendered?.[folderId] ?? db.renderedVideos?.[folderId] ?? [];
                return list.map((item) => asString(item.tupleKey)).filter((key) => key.length > 0);
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể tải lịch sử mã tổ hợp đã render",
                  cause,
                }),
            }),
    };
  }),
);

export const PlannedVideoRepoLive = Layer.succeed(PlannedVideoRepo, {
  replaceAll: () => Effect.void,
});
