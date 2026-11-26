import { Effect, Option, Result, Schema } from "effect";

import { MediaUrl } from "@/contexts/shared-kernel";

import type { RenderFailed, RenderProgressed, RenderSucceeded } from "../domain/events";
import { applyProgress, markFailed, markSucceeded } from "../domain/render-job";
import { Percent, ZvidJobId } from "../domain/types";
import { MediaDownloader, RenderedHistoryRepo, RenderJobRepo } from "./ports";

export const ProviderUpdateInput = Schema.Struct({
  providerJobId: ZvidJobId,
  status: Schema.Literals(["active", "completed", "failed"]),
  progress: Schema.optional(Percent),
  remoteUrl: Schema.optional(MediaUrl),
  errorMessage: Schema.optional(Schema.String),
  nowIso: Schema.NonEmptyString,
});
export type ProviderUpdateInput = typeof ProviderUpdateInput.Type;

export const applyProviderUpdate = (
  input: ProviderUpdateInput,
): Effect.Effect<
  RenderProgressed | RenderSucceeded | RenderFailed,
  unknown,
  RenderJobRepo | RenderedHistoryRepo | MediaDownloader
> =>
  Effect.gen(function* () {
    const jobRepo = yield* RenderJobRepo;
    const historyRepo = yield* RenderedHistoryRepo;
    const downloader = yield* MediaDownloader;

    const currentJob = yield* jobRepo.findByProviderJobId(input.providerJobId);

    if (input.status === "active") {
      const nextResult = applyProgress(currentJob, input.progress ?? (0 as Percent));
      if (Result.isFailure(nextResult)) {
        return yield* Effect.fail(nextResult.failure);
      }
      yield* jobRepo.save(nextResult.success);
      return {
        _tag: "RenderProgressed",
        jobId: nextResult.success.id,
        progress: nextResult.success.progress,
      } satisfies RenderProgressed;
    }

    if (input.status === "failed") {
      const nextResult = markFailed(
        currentJob,
        {
          code: "ZvidRenderFailed",
          message: input.errorMessage ?? "Render thất bại trên Zvid.",
        },
        input.nowIso,
      );
      if (Result.isFailure(nextResult)) {
        return yield* Effect.fail(nextResult.failure);
      }
      yield* jobRepo.save(nextResult.success);
      return {
        _tag: "RenderFailed",
        jobId: nextResult.success.id,
        reason: nextResult.success.reason,
      } satisfies RenderFailed;
    }

    const remoteUrl = input.remoteUrl ?? ("" as MediaUrl);
    const localUrl = yield* downloader.persistRemoteVideo(remoteUrl, currentJob.id);
    const output = {
      remoteUrl,
      localUrl,
      expiresAt: Option.none(),
    };
    const nextResult = markSucceeded(currentJob, output, input.nowIso);
    if (Result.isFailure(nextResult)) {
      return yield* Effect.fail(nextResult.failure);
    }

    yield* jobRepo.save(nextResult.success);
    yield* historyRepo.record(nextResult.success);

    return {
      _tag: "RenderSucceeded",
      jobId: nextResult.success.id,
      output,
    } satisfies RenderSucceeded;
  });
