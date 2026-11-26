import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

import { makeHttpClient } from "../client";

describe("platform/http/client", () => {
  const ItemSchema = Schema.Struct({ ok: Schema.Boolean, count: Schema.Number });

  it("fetches and decodes JSON with Schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, count: 3 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const http = makeHttpClient(fetchMock);
    const data = await Effect.runPromise(
      http.fetchJson({ service: "python", url: "http://localhost:3006/health" }, ItemSchema),
    );
    expect(data).toEqual({ ok: true, count: 3 });
  });

  it("maps non-2xx HTTP status to UpstreamError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 502 }));
    const http = makeHttpClient(fetchMock);

    const err = await Effect.runPromise(
      Effect.flip(http.fetchJson({ service: "zvid", url: "https://api.zvid.io/v1" }, ItemSchema)),
    );
    expect(err._tag).toBe("UpstreamError");
    expect(err.status).toBe(502);
    expect(err.service).toBe("zvid");
  });

  it("maps invalid response schema to UpstreamError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: "not-a-bool" }), { status: 200 }));
    const http = makeHttpClient(fetchMock);

    const err = await Effect.runPromise(
      Effect.flip(
        http.fetchJson({ service: "python", url: "http://localhost:3006/detect" }, ItemSchema),
      ),
    );
    expect(err._tag).toBe("UpstreamError");
    expect(err.message).toContain("Unexpected response schema");
  });

  it("fetches binary buffer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("hello", { status: 200 }));
    const http = makeHttpClient(fetchMock);

    const buf = await Effect.runPromise(
      http.fetchBuffer({ service: "drive", url: "https://drive.google.com/file" }),
    );
    expect(buf.toString("utf8")).toBe("hello");
  });
});
