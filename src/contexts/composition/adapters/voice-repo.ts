import "server-only";

import fs from "node:fs";
import path from "node:path";

import { Effect, Layer, Option } from "effect";

import type { LocalPath, MediaUrl, Seconds, VoiceId } from "@/contexts/shared-kernel";
import { PersistenceError } from "@/platform/errors";
import { buildBatchInsertTemplate, SqlClient } from "@/platform/sql";

import type { VoiceClip } from "../domain/types";
import { VoiceLibraryRepo } from "../workflows/ports";

const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "data", "sqlitecloud_local.json");

interface LocalVoiceItem {
  id: string;
  name: string;
  fileName: string;
  localUrl: string;
  localPath?: string;
  duration: number;
}

interface LocalDbJson {
  voices?: Record<string, Array<LocalVoiceItem> | undefined>;
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

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

export const VoiceLibraryRepoLive = Layer.effect(
  VoiceLibraryRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      list: (folderId) =>
        sql.isCloud
          ? sql.query`SELECT id, name, file_name, local_url, local_path, duration FROM lachvid_voice_items WHERE project_id = ${folderId} ORDER BY created_at ASC`.pipe(
              Effect.map((rows) =>
                rows.map((row): VoiceClip => ({
                  id: asString(row.id) as VoiceId,
                  name: asString(row.name) || "Voice",
                  fileName: asString(row.file_name) || "voice.mp3",
                  localUrl: asString(row.local_url) as MediaUrl,
                  localPath:
                    typeof row.local_path === "string" && row.local_path.length > 0
                      ? Option.some(row.local_path as LocalPath)
                      : Option.none(),
                  duration: Math.max(0.5, asNumber(row.duration, 10)) as Seconds,
                })),
              ),
            )
          : Effect.try({
              try: () =>
                (readLocalDb().voices?.[folderId] ?? []).map((v): VoiceClip => ({
                  id: v.id as VoiceId,
                  name: v.name,
                  fileName: v.fileName,
                  localUrl: v.localUrl as MediaUrl,
                  localPath: v.localPath ? Option.some(v.localPath as LocalPath) : Option.none(),
                  duration: Math.max(0.5, v.duration) as Seconds,
                })),
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể tải danh sách voice",
                  cause,
                }),
            }),

      addVoices: (folderId, voices) => {
        if (voices.length === 0) return Effect.void;
        if (sql.isCloud) {
          const BATCH_SIZE = 50;
          const now = new Date().toISOString();
          const batches: Array<ReadonlyArray<VoiceClip>> = [];
          for (let i = 0; i < voices.length; i += BATCH_SIZE) {
            batches.push(voices.slice(i, i + BATCH_SIZE));
          }
          return Effect.forEach(
            batches,
            (batch) => {
              const rows = batch.map((v) => {
                const localPath = Option.getOrNull(v.localPath);
                const sourceType =
                  v.localUrl.includes("/api/drive-stream/") ||
                  v.localUrl.includes("drive.google.com")
                    ? "drive"
                    : "local";
                return [
                  v.id,
                  folderId,
                  v.name,
                  v.fileName,
                  v.localUrl,
                  localPath,
                  v.duration,
                  sourceType,
                  now,
                ] as const;
              });
              const { strings, values } = buildBatchInsertTemplate(
                "INSERT OR REPLACE INTO lachvid_voice_items (id, project_id, name, file_name, local_url, local_path, duration, source_type, created_at) VALUES ",
                rows,
              );
              return sql.execute(strings, ...values);
            },
            { discard: true },
          );
        }
        return Effect.try({
          try: () => {
            const db = readLocalDb();
            const voicesMap = { ...(db.voices ?? {}) };
            const current = voicesMap[folderId] ?? [];
            const incomingIds = new Set(voices.map((v) => v.id));
            voicesMap[folderId] = [
              ...current.filter((item) => !incomingIds.has(item.id as VoiceId)),
              ...voices.map((v) => ({
                id: v.id,
                name: v.name,
                fileName: v.fileName,
                localUrl: v.localUrl,
                duration: v.duration,
              })),
            ];
            writeLocalDb({ ...db, voices: voicesMap });
          },
          catch: (cause) =>
            new PersistenceError({
              message: "Không thể lưu voice",
              cause,
            }),
        });
      },

      removeVoice: (folderId, voiceId) =>
        sql.isCloud
          ? sql.query`DELETE FROM lachvid_voice_items WHERE project_id = ${folderId} AND id = ${voiceId}`.pipe(
              Effect.asVoid,
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const voicesMap = { ...(db.voices ?? {}) };
                const current = voicesMap[folderId];
                if (!current) return;
                voicesMap[folderId] = current.filter((v) => v.id !== voiceId);
                writeLocalDb({ ...db, voices: voicesMap });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: "Không thể xoá voice",
                  cause,
                }),
            }),
    };
  }),
);
