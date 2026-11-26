import "server-only";

import fs from "node:fs";
import path from "node:path";

import { Effect, Layer, Option } from "effect";

import type { FolderId, MediaUrl } from "@/contexts/shared-kernel";
import { PersistenceError } from "@/platform/errors";
import { SqlClient } from "@/platform/sql";

import { RecordNotFound } from "../domain/errors";
import type { RenderedRecord, RenderedRecordId, RenderedRecordStatus } from "../domain/types";
import { RenderedHistoryRepo } from "../workflows/ports";

const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "data", "sqlitecloud_local.json");

interface LocalRenderedRow {
  id: string;
  projectId: string;
  name: string;
  tupleKey?: string;
  outputUrl?: string | null;
  payload?: unknown;
  status?: "unused" | "used";
  used?: boolean;
  renderedAt?: string;
  createdAt?: string;
}

interface LocalDbJson {
  rendered?: Record<string, Array<LocalRenderedRow> | undefined>;
  renderedVideos?: Record<string, Array<LocalRenderedRow> | undefined>;
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

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const parsePayload = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
};

const toDomainRecord = (row: Record<string, unknown>): RenderedRecord => {
  const usedRaw = row.used ?? row.status;
  const status: RenderedRecordStatus =
    usedRaw === true || usedRaw === 1 || usedRaw === "used" ? "used" : "unused";
  const outputUrlRaw = asString(row.output_url ?? row.outputUrl);
  const payload = parsePayload(row.payload);
  return {
    id: asString(row.id) as RenderedRecordId,
    folderId: asString(row.project_id ?? row.projectId) as FolderId,
    tupleKey: asString(row.tuple_key ?? row.tupleKey),
    name: asString(row.video_name ?? row.name, "Video đã render"),
    outputUrl: outputUrlRaw.length > 0 ? Option.some(outputUrlRaw as MediaUrl) : Option.none(),
    status,
    renderedAt: asString(
      row.rendered_at ?? row.renderedAt ?? row.created_at ?? row.createdAt,
      new Date().toISOString(),
    ),
    ...(payload !== undefined ? { payload } : {}),
  };
};

export const RenderedHistoryRepoLive = Layer.effect(
  RenderedHistoryRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      listByFolder: (folderId) =>
        sql.isCloud
          ? sql.query`SELECT id, project_id, video_name, tuple_key, payload, status, rendered_at FROM lachvid_rendered_history WHERE project_id = ${folderId} ORDER BY rendered_at DESC`.pipe(
              Effect.map((rows) => rows.map((row) => toDomainRecord({ ...row, used: row.status }))),
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const list = db.renderedVideos?.[folderId] ?? db.rendered?.[folderId] ?? [];
                return [...list]
                  .sort((a, b) =>
                    asString(b.renderedAt ?? b.createdAt).localeCompare(
                      asString(a.renderedAt ?? a.createdAt),
                    ),
                  )
                  .map((item) => toDomainRecord(item as unknown as Record<string, unknown>));
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể tải danh sách lịch sử render",
                  cause,
                }),
            }),

      findById: (id) =>
        sql.isCloud
          ? sql.query`SELECT id, project_id, video_name, tuple_key, payload, status, rendered_at FROM lachvid_rendered_history WHERE id = ${id} LIMIT 1`.pipe(
              Effect.flatMap((rows) => {
                const row = rows.at(0);
                if (!row) {
                  return Effect.fail(
                    new RecordNotFound({
                      recordId: id,
                      message: "Không tìm thấy video đã render.",
                    }),
                  );
                }
                return Effect.succeed(toDomainRecord({ ...row, used: row.status }));
              }),
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const groups = [
                  ...Object.values(db.renderedVideos ?? {}),
                  ...Object.values(db.rendered ?? {}),
                ];
                for (const list of groups) {
                  const found = (list ?? []).find((item) => item.id === id);
                  if (found) {
                    return toDomainRecord(found as unknown as Record<string, unknown>);
                  }
                }
                return null;
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể tra cứu video đã render",
                  cause,
                }),
            }).pipe(
              Effect.flatMap((rec) =>
                rec
                  ? Effect.succeed(rec)
                  : Effect.fail(
                      new RecordNotFound({
                        recordId: id,
                        message: "Không tìm thấy video đã render.",
                      }),
                    ),
              ),
            ),

      record: (job) =>
        sql.isCloud
          ? sql.query`INSERT OR REPLACE INTO lachvid_rendered_history (id, project_id, tuple_key, video_name, status, rendered_at) VALUES (${job.id}, ${job.plan.folderId}, ${job.plan.tupleKey}, ${job.plan.name}, 'unused', ${job.finishedAt})`.pipe(
              Effect.asVoid,
            )
          : Effect.void,

      recordBatch: (folderId, entries) => {
        const now = new Date().toISOString();
        const createdRecords: ReadonlyArray<{
          readonly record: RenderedRecord;
          readonly payloadStr: string | null;
          readonly payloadRaw: unknown;
        }> = entries.map((entry, idx) => {
          const randSuffix = Math.random().toString(36).slice(2, 6);
          const id =
            `rend_${Date.now().toString(36)}_${String(idx)}_${randSuffix}` as RenderedRecordId;
          const payloadStr = entry.payload !== undefined ? JSON.stringify(entry.payload) : null;
          return {
            record: {
              id,
              folderId,
              tupleKey: entry.tupleKey,
              name: entry.name || "Video đã render",
              outputUrl: Option.none(),
              status: "unused",
              renderedAt: now,
              ...(entry.payload !== undefined ? { payload: entry.payload } : {}),
            },
            payloadStr,
            payloadRaw: entry.payload,
          };
        });

        if (sql.isCloud) {
          return Effect.forEach(
            createdRecords,
            ({ record, payloadStr }) =>
              sql.query`INSERT INTO lachvid_rendered_history (id, project_id, tuple_key, video_name, payload, status, rendered_at) VALUES (${record.id}, ${folderId}, ${record.tupleKey}, ${record.name}, ${payloadStr}, 'unused', ${record.renderedAt})`,
            { discard: true },
          ).pipe(
            Effect.andThen(
              sql.query`UPDATE lachvid_projects SET updated_at = ${now} WHERE id = ${folderId}`,
            ),
            Effect.map(() => createdRecords.map((c) => c.record)),
          );
        }

        return Effect.try({
          try: () => {
            const db = readLocalDb();
            const renderedMap = { ...(db.rendered ?? {}) };
            const renderedVideosMap = { ...(db.renderedVideos ?? {}) };
            const newRows: Array<LocalRenderedRow> = createdRecords.map(
              ({ record, payloadRaw }) => ({
                id: record.id,
                projectId: folderId,
                name: record.name,
                tupleKey: record.tupleKey,
                payload: payloadRaw,
                status: "unused",
                used: false,
                renderedAt: record.renderedAt,
                createdAt: record.renderedAt,
              }),
            );
            renderedMap[folderId] = [...(renderedMap[folderId] ?? []), ...newRows];
            renderedVideosMap[folderId] = [...(renderedVideosMap[folderId] ?? []), ...newRows];
            writeLocalDb({
              ...db,
              rendered: renderedMap,
              renderedVideos: renderedVideosMap,
            });
            return createdRecords.map((c) => c.record);
          },
          catch: (cause) =>
            new PersistenceError({
              message: "Không thể lưu lịch sử render hàng loạt",
              cause,
            }),
        });
      },

      updateStatus: (id, status) =>
        sql.isCloud
          ? sql.query`UPDATE lachvid_rendered_history SET status = ${status} WHERE id = ${id}`.pipe(
              Effect.asVoid,
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const map1 = { ...(db.renderedVideos ?? {}) };
                for (const [key, list] of Object.entries(map1)) {
                  if (!list) continue;
                  map1[key] = list.map((item) =>
                    item.id === id ? { ...item, used: status === "used", status } : item,
                  );
                }
                const map2 = { ...(db.rendered ?? {}) };
                for (const [key, list] of Object.entries(map2)) {
                  if (!list) continue;
                  map2[key] = list.map((item) =>
                    item.id === id ? { ...item, used: status === "used", status } : item,
                  );
                }
                writeLocalDb({ ...db, renderedVideos: map1, rendered: map2 });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể cập nhật trạng thái video",
                  cause,
                }),
            }),

      remove: (id) =>
        sql.isCloud
          ? sql.query`DELETE FROM lachvid_rendered_history WHERE id = ${id}`.pipe(Effect.asVoid)
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const map1 = { ...(db.renderedVideos ?? {}) };
                for (const [key, list] of Object.entries(map1)) {
                  if (!list) continue;
                  map1[key] = list.filter((item) => item.id !== id);
                }
                const map2 = { ...(db.rendered ?? {}) };
                for (const [key, list] of Object.entries(map2)) {
                  if (!list) continue;
                  map2[key] = list.filter((item) => item.id !== id);
                }
                writeLocalDb({ ...db, renderedVideos: map1, rendered: map2 });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể xoá video đã render",
                  cause,
                }),
            }),

      clearByFolder: (folderId) =>
        sql.isCloud
          ? sql.query`DELETE FROM lachvid_rendered_history WHERE project_id = ${folderId}`.pipe(
              Effect.asVoid,
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const map1 = { ...(db.renderedVideos ?? {}) };
                map1[folderId] = [];
                const map2 = { ...(db.rendered ?? {}) };
                map2[folderId] = [];
                writeLocalDb({ ...db, renderedVideos: map1, rendered: map2 });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể xoá toàn bộ lịch sử render",
                  cause,
                }),
            }),
    };
  }),
);
