import "server-only";

import { Cause, Effect, Exit, ManagedRuntime, Schema } from "effect";
import { forbidden, notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";

import type { ActionFailure, ActionResult } from "@/shared/types/action";

import {
  ForbiddenError,
  NotFoundError,
  type PlatformError,
  UnauthorizedError,
  ValidationError,
} from "./errors";
import { appRuntime } from "./runtime";

type TaggedErrorLike = {
  readonly _tag: string;
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

const isTaggedErrorLike = (u: unknown): u is TaggedErrorLike =>
  typeof u === "object" && u !== null && "_tag" in u && typeof u._tag === "string";

export const errorToActionFailure = (err: unknown): ActionFailure => {
  if (err instanceof ValidationError) {
    return {
      ok: false,
      error: err.message,
      code: err._tag,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
    };
  }
  if (isTaggedErrorLike(err)) {
    return {
      ok: false,
      error: err.message ?? "Đã xảy ra lỗi không xác định.",
      code: err._tag,
      ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
    };
  }
  return {
    ok: false,
    error: "Lỗi hệ thống. Vui lòng thử lại sau.",
    code: "InternalError",
  };
};

export const errorToHttpStatus = (err: unknown): number => {
  if (err instanceof ValidationError) return 400;
  if (err instanceof UnauthorizedError) return 401;
  if (err instanceof ForbiddenError) return 403;
  if (err instanceof NotFoundError) return 404;
  if (isTaggedErrorLike(err)) {
    switch (err._tag) {
      case "ValidationError":
        return 400;
      case "UnauthorizedError":
        return 401;
      case "ForbiddenError":
        return 403;
      case "NotFoundError":
        return 404;
      case "UpstreamError":
        return 502;
      default:
        return 500;
    }
  }
  return 500;
};

export const makeAction =
  <A, Output, E, R, ER = never>(
    schema: Schema.Decoder<A>,
    workflow: (input: A) => Effect.Effect<Output, E, R>,
    runtime: ManagedRuntime.ManagedRuntime<
      R,
      ER
    > = appRuntime as unknown as ManagedRuntime.ManagedRuntime<R, ER>,
  ) =>
  async (rawInput: unknown): Promise<ActionResult<Output>> => {
    const program = Effect.gen(function* () {
      const parsed = yield* Schema.decodeUnknownEffect(schema)(rawInput).pipe(
        Effect.mapError(
          (issue) =>
            new ValidationError({
              message: `Dữ liệu đầu vào không hợp lệ: ${String(issue)}`,
            }),
        ),
      );
      return yield* workflow(parsed);
    });

    const exit = await runtime.runPromiseExit(program);
    if (Exit.isSuccess(exit)) {
      return { ok: true, data: exit.value };
    }
    const failure = Cause.findErrorOption(exit.cause);
    if (failure._tag === "Some") {
      return errorToActionFailure(failure.value);
    }
    return {
      ok: false,
      error: "Lỗi hệ thống. Vui lòng thử lại sau.",
      code: "UnexpectedDefect",
    };
  };

export const runQuery = async <A, E extends PlatformError | TaggedErrorLike, R, ER = never>(
  effect: Effect.Effect<A, E, R>,
  runtime: ManagedRuntime.ManagedRuntime<
    R,
    ER
  > = appRuntime as unknown as ManagedRuntime.ManagedRuntime<R, ER>,
): Promise<A> => {
  const exit = await runtime.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  const failure = Cause.findErrorOption(exit.cause);
  if (failure._tag === "Some") {
    const err = failure.value;
    if (
      err instanceof UnauthorizedError ||
      (isTaggedErrorLike(err) && err._tag === "UnauthorizedError")
    ) {
      redirect("/login");
    }
    if (err instanceof NotFoundError || (isTaggedErrorLike(err) && err._tag === "NotFoundError")) {
      notFound();
    }
    if (
      err instanceof ForbiddenError ||
      (isTaggedErrorLike(err) && err._tag === "ForbiddenError")
    ) {
      forbidden();
    }
    throw new Error(isTaggedErrorLike(err) && err.message ? err.message : "Query failed");
  }
  throw new Error("Unexpected query defect");
};

export const runRoute = async <A, E, R, ER = never>(
  effect: Effect.Effect<A, E, R>,
  runtime: ManagedRuntime.ManagedRuntime<
    R,
    ER
  > = appRuntime as unknown as ManagedRuntime.ManagedRuntime<R, ER>,
): Promise<NextResponse> => {
  const exit = await runtime.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    if (exit.value instanceof NextResponse) {
      return exit.value;
    }
    return NextResponse.json(exit.value);
  }
  const failure = Cause.findErrorOption(exit.cause);
  if (failure._tag === "Some") {
    const payload = errorToActionFailure(failure.value);
    const status = errorToHttpStatus(failure.value);
    return NextResponse.json({ error: payload.error, code: payload.code }, { status });
  }
  return NextResponse.json(
    { error: "Lỗi hệ thống. Vui lòng thử lại sau.", code: "UnexpectedDefect" },
    { status: 500 },
  );
};
