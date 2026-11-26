import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { Percent, RenderedRecord, RenderJob } from "../types";

describe("rendering domain types", () => {
  it("enforces Percent between 0 and 100", () => {
    const decode = Schema.decodeUnknownSync(Percent);
    expect(decode(0)).toBe(0);
    expect(decode(100)).toBe(100);
    expect(() => decode(-1)).toThrow();
    expect(() => decode(101)).toThrow();
  });

  it("decodes RenderJob state machine variants", () => {
    const decodeJob = Schema.decodeUnknownSync(RenderJob);
    const plan = {
      plannedVideoId: "pv_1",
      folderId: "fld_1",
      name: "Mix #1",
      tupleKey: "a|b|c|d|e",
      duration: 20,
    };

    const draft = decodeJob({ _tag: "Draft", id: "job_1", plan });
    expect(draft._tag).toBe("Draft");

    const succeeded = decodeJob({
      _tag: "Succeeded",
      id: "job_1",
      plan,
      providerJobId: "zvid_99",
      output: {
        remoteUrl: "https://cdn.zvid.io/out.mp4",
        localUrl: "/api/media/out.mp4",
        expiresAt: null,
      },
      finishedAt: "2026-11-17T10:00:00Z",
    });
    expect(succeeded._tag).toBe("Succeeded");
  });

  it("decodes RenderedRecord status", () => {
    const decodeRecord = Schema.decodeUnknownSync(RenderedRecord);
    const rec = decodeRecord({
      id: "rec_1",
      folderId: "fld_1",
      tupleKey: "a|b|c|d|e",
      name: "Mix #1",
      outputUrl: null,
      status: "unused",
      renderedAt: "2026-11-17T10:00:00Z",
    });
    expect(rec.status).toBe("unused");
  });
});
