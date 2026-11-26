import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { makeSqlClientFromDatabase } from "../client";

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
});
