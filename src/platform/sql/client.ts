import "server-only";

import { Database } from "@sqlitecloud/drivers";
import { Context, Effect, Layer, Option } from "effect";

import { AppConfig } from "../config";
import { PersistenceError } from "../errors";

export interface SqlClientValue {
  readonly isCloud: boolean;
  readonly query: (
    strings: TemplateStringsArray,
    ...values: ReadonlyArray<unknown>
  ) => Effect.Effect<ReadonlyArray<Record<string, unknown>>, PersistenceError>;
  readonly execute: (
    strings: TemplateStringsArray,
    ...values: ReadonlyArray<unknown>
  ) => Effect.Effect<void, PersistenceError>;
}

export class SqlClient extends Context.Service<SqlClient, SqlClientValue>()("platform/SqlClient") {}

export const makeSqlClientFromDatabase = (db: Pick<Database, "sql"> | null): SqlClientValue => {
  if (!db) {
    return {
      isCloud: false,
      query: () =>
        Effect.fail(
          new PersistenceError({
            message: "SQLite Cloud is not configured (local fallback mode).",
          }),
        ),
      execute: () =>
        Effect.fail(
          new PersistenceError({
            message: "SQLite Cloud is not configured (local fallback mode).",
          }),
        ),
    };
  }

  return {
    isCloud: true,
    query: (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) =>
      Effect.tryPromise({
        try: async () => {
          const rows: unknown = await db.sql(strings, ...values);
          return Array.isArray(rows) ? (rows as ReadonlyArray<Record<string, unknown>>) : [];
        },
        catch: (cause) =>
          new PersistenceError({
            message: `SQL query failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          }),
      }),
    execute: (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) =>
      Effect.tryPromise({
        try: async () => {
          await db.sql(strings, ...values);
        },
        catch: (cause) =>
          new PersistenceError({
            message: `SQL execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          }),
      }),
  };
};

export const SqlClientLive = Layer.effect(
  SqlClient,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const db = Option.match(config.sqliteCloudUrl, {
      onNone: () => null,
      onSome: (url) => new Database(url),
    });
    return makeSqlClientFromDatabase(db);
  }),
);
