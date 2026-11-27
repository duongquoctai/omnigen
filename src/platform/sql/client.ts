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

export interface SqlDatabaseLike {
  readonly sql: Database["sql"];
  readonly close?: () => void;
}

export class SqlClient extends Context.Service<SqlClient, SqlClientValue>()("platform/SqlClient") {}

const CONNECTION_LOST_CODES = new Set([
  "ERR_CONNECTION_NOT_ESTABLISHED",
  "ERR_CONNECTION_CLOSED",
  "ERR_CONNECTION_ENDED",
  "ERR_CONNECTION_TIMEOUT",
]);

const CONNECTION_LOST_PATTERN =
  /connection unavailable|disconnected|connection closed|server ended the connection|connection.*timeout|econnreset|epipe|etimedout|socket/i;

export const isConnectionLostError = (cause: unknown): boolean => {
  if (typeof cause === "object" && cause !== null && "errorCode" in cause) {
    const code = (cause as { readonly errorCode?: unknown }).errorCode;
    if (typeof code === "string" && CONNECTION_LOST_CODES.has(code)) {
      return true;
    }
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  return CONNECTION_LOST_PATTERN.test(message);
};

export const buildBatchInsertTemplate = (
  prefix: string,
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): { readonly strings: TemplateStringsArray; readonly values: ReadonlyArray<unknown> } => {
  const strings: Array<string> = [];
  const values: Array<unknown> = [];

  for (const row of rows) {
    if (row.length === 0) continue;
    for (let c = 0; c < row.length; c += 1) {
      if (values.length === 0) {
        strings.push(`${prefix}(`);
      } else if (c === 0) {
        strings.push("), (");
      } else {
        strings.push(", ");
      }
      values.push(row[c]);
    }
  }

  if (values.length === 0) {
    const empty = [prefix];
    return {
      strings: Object.assign(empty, { raw: [...empty] }),
      values: [],
    };
  }

  strings.push(")");
  return {
    strings: Object.assign(strings, { raw: [...strings] }),
    values,
  };
};

const closeQuietly = (db: SqlDatabaseLike): void => {
  try {
    db.close?.();
  } catch {
    // Ignore errors while tearing down a stale connection
  }
};

export const makeSqlClientFromFactory = (
  createDb: (() => SqlDatabaseLike) | null,
): SqlClientValue => {
  if (!createDb) {
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

  const state: { db: SqlDatabaseLike | null } = { db: null };

  const getOrCreateDb = (): SqlDatabaseLike => {
    state.db ??= createDb();
    return state.db;
  };

  const resetDbIfCurrent = (failedDb: SqlDatabaseLike): SqlDatabaseLike => {
    if (state.db === failedDb) {
      closeQuietly(failedDb);
      state.db = createDb();
    }
    return getOrCreateDb();
  };

  const runOnce = (
    db: SqlDatabaseLike,
    strings: TemplateStringsArray,
    values: ReadonlyArray<unknown>,
    errorPrefix: string,
  ): Effect.Effect<unknown, PersistenceError> =>
    Effect.tryPromise({
      try: () => db.sql(strings, ...values),
      catch: (cause) =>
        new PersistenceError({
          message: `${errorPrefix}: ${cause instanceof Error ? cause.message : String(cause)}`,
          cause,
        }),
    });

  const runWithReconnect = (
    strings: TemplateStringsArray,
    values: ReadonlyArray<unknown>,
    errorPrefix: string,
  ): Effect.Effect<unknown, PersistenceError> =>
    Effect.suspend(() => {
      const db = getOrCreateDb();
      return runOnce(db, strings, values, errorPrefix).pipe(
        Effect.catchIf(
          (err) => isConnectionLostError(err.cause),
          () => {
            const freshDb = resetDbIfCurrent(db);
            return runOnce(freshDb, strings, values, errorPrefix);
          },
        ),
      );
    });

  return {
    isCloud: true,
    query: (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) =>
      runWithReconnect(strings, values, "SQL query failed").pipe(
        Effect.map((rows) =>
          Array.isArray(rows) ? (rows as ReadonlyArray<Record<string, unknown>>) : [],
        ),
      ),
    execute: (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) =>
      runWithReconnect(strings, values, "SQL execution failed").pipe(Effect.asVoid),
  };
};

export const makeSqlClientFromDatabase = (db: Pick<Database, "sql"> | null): SqlClientValue => {
  if (!db) {
    return makeSqlClientFromFactory(null);
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
    const factory = Option.match(config.sqliteCloudUrl, {
      onNone: () => null,
      onSome: (url) => () => {
        const db = new Database(url);
        db.on("error", () => undefined);
        return db;
      },
    });
    return makeSqlClientFromFactory(factory);
  }),
);
