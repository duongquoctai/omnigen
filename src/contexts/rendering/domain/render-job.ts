import { Match, Result } from "effect";

import { InvalidJobTransition } from "./errors";
import type {
  Credits,
  Percent,
  RenderedRecord,
  RenderFailure,
  RenderJob,
  RenderOutput,
  ZvidJobId,
} from "./types";

const invalidTransition = (job: RenderJob, toState: string): InvalidJobTransition =>
  new InvalidJobTransition({
    jobId: job.id,
    fromState: job._tag,
    toState,
    message: `Không thể chuyển job ${job.id} từ "${job._tag}" sang "${toState}".`,
  });

export const markValidated = (
  job: RenderJob,
  creditsRequired: Credits,
): Result.Result<Extract<RenderJob, { readonly _tag: "Validated" }>, InvalidJobTransition> =>
  Match.value(job).pipe(
    Match.tag("Draft", (draft) =>
      Result.succeed({
        _tag: "Validated" as const,
        id: draft.id,
        plan: draft.plan,
        creditsRequired,
      }),
    ),
    Match.orElse(() => Result.fail(invalidTransition(job, "Validated"))),
  );

export const markSubmitted = (
  job: RenderJob,
  providerJobId: ZvidJobId,
  submittedAt: string,
): Result.Result<Extract<RenderJob, { readonly _tag: "Submitted" }>, InvalidJobTransition> =>
  Match.value(job).pipe(
    Match.tag("Validated", (validated) =>
      Result.succeed({
        _tag: "Submitted" as const,
        id: validated.id,
        plan: validated.plan,
        providerJobId,
        submittedAt,
      }),
    ),
    Match.orElse(() => Result.fail(invalidTransition(job, "Submitted"))),
  );

export const applyProgress = (
  job: RenderJob,
  progress: Percent,
): Result.Result<Extract<RenderJob, { readonly _tag: "Running" }>, InvalidJobTransition> =>
  Match.value(job).pipe(
    Match.tag("Submitted", (sub) =>
      Result.succeed({
        _tag: "Running" as const,
        id: sub.id,
        plan: sub.plan,
        providerJobId: sub.providerJobId,
        progress,
      }),
    ),
    Match.tag("Running", (run) =>
      Result.succeed({
        ...run,
        progress,
      }),
    ),
    Match.orElse(() => Result.fail(invalidTransition(job, "Running"))),
  );

export const markSucceeded = (
  job: RenderJob,
  output: RenderOutput,
  finishedAt: string,
): Result.Result<Extract<RenderJob, { readonly _tag: "Succeeded" }>, InvalidJobTransition> =>
  Match.value(job).pipe(
    Match.tag("Submitted", (sub) =>
      Result.succeed({
        _tag: "Succeeded" as const,
        id: sub.id,
        plan: sub.plan,
        providerJobId: sub.providerJobId,
        output,
        finishedAt,
      }),
    ),
    Match.tag("Running", (run) =>
      Result.succeed({
        _tag: "Succeeded" as const,
        id: run.id,
        plan: run.plan,
        providerJobId: run.providerJobId,
        output,
        finishedAt,
      }),
    ),
    Match.orElse(() => Result.fail(invalidTransition(job, "Succeeded"))),
  );

export const markFailed = (
  job: RenderJob,
  reason: RenderFailure,
  failedAt: string,
): Result.Result<Extract<RenderJob, { readonly _tag: "Failed" }>, InvalidJobTransition> =>
  Match.value(job).pipe(
    Match.tag("Succeeded", () => Result.fail(invalidTransition(job, "Failed"))),
    Match.tag("Failed", () => Result.fail(invalidTransition(job, "Failed"))),
    Match.orElse((active) =>
      Result.succeed({
        _tag: "Failed" as const,
        id: active.id,
        plan: active.plan,
        reason,
        failedAt,
      }),
    ),
  );

export const setRecordUsed = (record: RenderedRecord, used: boolean): RenderedRecord => ({
  ...record,
  status: used ? "used" : "unused",
});
