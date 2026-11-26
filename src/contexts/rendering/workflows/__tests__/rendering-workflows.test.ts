import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import type { FolderId, MediaUrl, RenderJobId, Seconds } from "@/contexts/shared-kernel";

import type {
  Percent,
  RenderedRecord,
  RenderedRecordId,
  RenderJob,
  ZvidJobId,
} from "../../domain/types";
import { applyProviderUpdate } from "../apply-provider-update";
import { deleteRenderedRecord, markRecordUsed } from "../mark-record-used";
import { MediaDownloader, RenderedHistoryRepo, RenderJobRepo } from "../ports";

const submittedJob: RenderJob = {
  _tag: "Submitted",
  id: "job_1" as RenderJobId,
  plan: {
    plannedVideoId: "pv_1",
    folderId: "fld_1" as FolderId,
    name: "Mix #1",
    tupleKey: "a|b|c|d|e",
    duration: 20 as Seconds,
  },
  providerJobId: "zvid_1" as ZvidJobId,
  submittedAt: "2026-11-17T10:00:00Z",
};

describe("rendering/workflows", () => {
  it.effect("applies progress, completion, and failure updates", () => {
    let savedJob: RenderJob = submittedJob;
    let recordedCount = 0;

    const TestLayer = Layer.mergeAll(
      Layer.succeed(RenderJobRepo, {
        findById: () => Effect.succeed(savedJob),
        findByProviderJobId: () => Effect.succeed(savedJob),
        save: (job) => {
          savedJob = job;
          return Effect.void;
        },
      }),
      Layer.succeed(RenderedHistoryRepo, {
        listByFolder: () => Effect.succeed([]),
        findById: () =>
          Effect.succeed({
            id: "rec_1" as RenderedRecordId,
            folderId: "fld_1" as FolderId,
            tupleKey: "a|b|c|d|e",
            name: "Mix #1",
            outputUrl: Option.none(),
            status: "unused",
            renderedAt: "2026-11-17T10:00:00Z",
          } satisfies RenderedRecord),
        record: () => {
          recordedCount += 1;
          return Effect.void;
        },
        recordBatch: (_fid, entries) =>
          Effect.succeed(
            entries.map((e, i) => ({
              id: `rec_b_${String(i)}` as RenderedRecordId,
              folderId: "fld_1" as FolderId,
              tupleKey: e.tupleKey,
              name: e.name,
              outputUrl: Option.none(),
              status: "unused" as const,
              renderedAt: "2026-11-17T10:00:00Z",
            })),
          ),
        updateStatus: () => Effect.void,
        remove: () => Effect.void,
        clearByFolder: () => Effect.void,
      }),
      Layer.succeed(MediaDownloader, {
        persistRemoteVideo: () => Effect.succeed("/api/media/out.mp4" as MediaUrl),
      }),
    );

    return Effect.gen(function* () {
      const prog = yield* applyProviderUpdate({
        providerJobId: "zvid_1" as ZvidJobId,
        status: "active",
        progress: 40 as Percent,
        nowIso: "2026-11-17T10:00:10Z",
      });
      expect(prog._tag).toBe("RenderProgressed");

      const done = yield* applyProviderUpdate({
        providerJobId: "zvid_1" as ZvidJobId,
        status: "completed",
        remoteUrl: "https://cdn.zvid.io/out.mp4" as MediaUrl,
        nowIso: "2026-11-17T10:01:00Z",
      });
      expect(done._tag).toBe("RenderSucceeded");
      expect(recordedCount).toBe(1);

      const recEvt = yield* markRecordUsed({
        recordId: "rec_1" as RenderedRecordId,
        used: true,
      });
      expect(recEvt.status).toBe("used");

      const deleted = yield* deleteRenderedRecord({
        recordId: "rec_1" as RenderedRecordId,
      });
      expect(deleted.recordId).toBe("rec_1");
    }).pipe(Effect.provide(TestLayer));
  });

  it.effect("applies failed update from provider", () => {
    let savedJob: RenderJob = submittedJob;
    const FailLayer = Layer.mergeAll(
      Layer.succeed(RenderJobRepo, {
        findById: () => Effect.succeed(savedJob),
        findByProviderJobId: () => Effect.succeed(savedJob),
        save: (job) => {
          savedJob = job;
          return Effect.void;
        },
      }),
      Layer.succeed(RenderedHistoryRepo, {
        listByFolder: () => Effect.succeed([]),
        findById: () =>
          Effect.succeed({
            id: "rec_1" as RenderedRecordId,
            folderId: "fld_1" as FolderId,
            tupleKey: "a|b|c|d|e",
            name: "Mix #1",
            outputUrl: Option.none(),
            status: "unused",
            renderedAt: "2026-11-17T10:00:00Z",
          } satisfies RenderedRecord),
        record: () => Effect.void,
        recordBatch: () => Effect.succeed([]),
        updateStatus: () => Effect.void,
        remove: () => Effect.void,
        clearByFolder: () => Effect.void,
      }),
      Layer.succeed(MediaDownloader, {
        persistRemoteVideo: () => Effect.succeed("/api/media/out.mp4" as MediaUrl),
      }),
    );

    return applyProviderUpdate({
      providerJobId: "zvid_1" as ZvidJobId,
      status: "failed",
      errorMessage: "FFmpeg crashed",
      nowIso: "2026-11-17T10:02:00Z",
    }).pipe(
      Effect.provide(FailLayer),
      Effect.map((evt) => {
        expect(evt._tag).toBe("RenderFailed");
        expect(savedJob._tag).toBe("Failed");
      }),
    );
  });
});
