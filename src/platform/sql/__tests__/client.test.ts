import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import {
  buildBatchInsertTemplate,
  isConnectionLostError,
  makeSqlClientFromDatabase,
  makeSqlClientFromFactory,
} from "../client";

describe("platform/sql/client", () => {
  it("reports local mode and fails query/execute when db is null", async () => {
    const client = makeSqlClientFromDatabase(null);
    expect(client.isCloud).toBe(false);

    const err = await Effect.runPromise(Effect.flip(client.query`SELECT 1`));
    expect(err._tag).toBe("PersistenceError");

    const execErr = await Effect.runPromise(Effect.flip(client.execute`DELETE FROM t`));
    expect(execErr._tag).toBe("PersistenceError");
  });

  it("queries and executes against Database sql tag", async () => {
    const sqlMock = vi.fn().mockResolvedValue([{ id: "1", name: "Folder A" }]);
    const client = makeSqlClientFromDatabase({ sql: sqlMock });

    expect(client.isCloud).toBe(true);
    const rows = await Effect.runPromise(client.query`SELECT * FROM t`);
    expect(rows).toEqual([{ id: "1", name: "Folder A" }]);

    await Effect.runPromise(client.execute`UPDATE t SET name = 'B'`);
    expect(sqlMock).toHaveBeenCalledTimes(2);
  });

  it("wraps database errors in PersistenceError", async () => {
    const sqlMock = vi.fn().mockRejectedValue(new Error("connection lost"));
    const client = makeSqlClientFromDatabase({ sql: sqlMock });

    const err = await Effect.runPromise(Effect.flip(client.query`SELECT 1`));
    expect(err._tag).toBe("PersistenceError");
    expect(err.message).toContain("connection lost");
  });

  it("reconnects and retries once when connection is unavailable or disconnected", async () => {
    const closeFirst = vi.fn();
    const firstSql = vi.fn().mockRejectedValue(
      Object.assign(new Error("Connection unavailable. Maybe it got disconnected?"), {
        errorCode: "ERR_CONNECTION_NOT_ESTABLISHED",
      }),
    );
    const secondSql = vi.fn().mockResolvedValue([{ id: "ok" }]);
    const createDb = vi
      .fn()
      .mockReturnValueOnce({ sql: firstSql, close: closeFirst })
      .mockReturnValueOnce({ sql: secondSql, close: vi.fn() });

    const client = makeSqlClientFromFactory(createDb);
    expect(client.isCloud).toBe(true);
    // Lazy connection: factory not called until first query
    expect(createDb).toHaveBeenCalledTimes(0);

    const rows = await Effect.runPromise(client.query`SELECT 1`);
    expect(rows).toEqual([{ id: "ok" }]);
    expect(createDb).toHaveBeenCalledTimes(2);
    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(firstSql).toHaveBeenCalledTimes(1);
    expect(secondSql).toHaveBeenCalledTimes(1);
  });

  it("does not reconnect on non-connection SQL errors", async () => {
    const firstSql = vi.fn().mockRejectedValue(new Error("UNIQUE constraint failed"));
    const createDb = vi.fn().mockReturnValue({ sql: firstSql, close: vi.fn() });

    const client = makeSqlClientFromFactory(createDb);
    const err = await Effect.runPromise(Effect.flip(client.execute`INSERT INTO t VALUES (1)`));
    expect(err._tag).toBe("PersistenceError");
    expect(err.message).toContain("UNIQUE constraint failed");
    expect(createDb).toHaveBeenCalledTimes(1);
    expect(isConnectionLostError(new Error("UNIQUE constraint failed"))).toBe(false);
    expect(
      isConnectionLostError(new Error("Connection unavailable. Maybe it got disconnected?")),
    ).toBe(true);
  });

  it("builds multi-row parameterized batch insert templates", () => {
    const { strings, values } = buildBatchInsertTemplate("INSERT INTO t (a, b) VALUES ", [
      [1, "x"],
      [2, "y"],
    ]);
    expect(strings.raw).toEqual(Array.from(strings));
    let rendered = "";
    strings.forEach((part, idx) => {
      rendered += part + (idx < values.length ? "?" : "");
    });
    expect(rendered).toBe("INSERT INTO t (a, b) VALUES (?, ?), (?, ?)");
    expect(values).toEqual([1, "x", 2, "y"]);
  });
});
