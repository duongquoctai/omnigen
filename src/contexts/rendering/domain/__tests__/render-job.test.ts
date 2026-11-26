import { Option, Result } from "effect";
import { describe, expect, it } from "vitest";

import type { FolderId, MediaUrl, RenderJobId, Seconds } from "@/contexts/shared-kernel";

import {
  applyProgress,
  markFailed,
  markSubmitted,
  markSucceeded,
  markValidated,
  setRecordUsed,
} from "../render-job";
import type {
  Credits,
  Percent,
  RenderedRecord,
  RenderedRecordId,
  RenderJob,
  ZvidJobId,
} from "../types";

const draftJob: RenderJob = {
  _tag: "Draft",
  id: "job_1" as RenderJobId,
  plan: {
    plannedVideoId: "pv_1",
    folderId: "fld_1" as FolderId,
    name: "Mix #1",
    tupleKey: "a|b|c|d|e",
    duration: 20 as Seconds,
  },
};

describe("rendering/domain/render-job", () => {
  it("transitions Draft -> Validated -> Submitted -> Running -> Succeeded", () => {
    const v = markValidated(draftJob, 2 as Credits);
    expect(Result.isSuccess(v)).toBe(true);
    if (Result.isFailure(v)) return;

    const s = markSubmitted(v.success, "zvid_1" as ZvidJobId, "2026-11-17T10:00:00Z");
    expect(Result.isSuccess(s)).toBe(true);
    if (Result.isFailure(s)) return;

    const r = applyProgress(s.success, 55 as Percent);
    expect(Result.isSuccess(r)).toBe(true);
    if (Result.isFailure(r)) return;
    expect(r.success.progress).toBe(55);

    const done = markSucceeded(
      r.success,
      {
        remoteUrl: "https://cdn.zvid.io/out.mp4" as MediaUrl,
        localUrl: "/api/media/out.mp4" as MediaUrl,
        expiresAt: Option.none(),
      },
      "2026-11-17T10:01:00Z",
    );
    expect(Result.isSuccess(done)).toBe(true);
  });

  it("rejects illegal transitions and terminal failures", () => {
    const badSubmit = markSubmitted(draftJob, "z1" as ZvidJobId, "2026-11-17T10:00:00Z");
    expect(Result.isFailure(badSubmit)).toBe(true);
    if (Result.isFailure(badSubmit)) {
      expect(badSubmit.failure._tag).toBe("InvalidJobTransition");
    }

    const badProgress = applyProgress(draftJob, 10 as Percent);
    expect(Result.isFailure(badProgress)).toBe(true);

    const failed = markFailed(draftJob, { code: "ERR", message: "boom" }, "2026-11-17T10:00:00Z");
    expect(Result.isSuccess(failed)).toBe(true);
    if (Result.isSuccess(failed)) {
      const failAgain = markFailed(
        failed.success,
        { code: "ERR2", message: "boom2" },
        "2026-11-17T10:01:00Z",
      );
      expect(Result.isFailure(failAgain)).toBe(true);
    }
  });

  it("toggles RenderedRecord status", () => {
    const rec: RenderedRecord = {
      id: "rec_1" as RenderedRecordId,
      folderId: "fld_1" as FolderId,
      tupleKey: "a|b|c|d|e",
      name: "Mix #1",
      outputUrl: Option.none(),
      status: "unused",
      renderedAt: "2026-11-17T10:00:00Z",
    };
    expect(setRecordUsed(rec, true).status).toBe("used");
    expect(setRecordUsed(setRecordUsed(rec, true), false).status).toBe("unused");
  });
});
