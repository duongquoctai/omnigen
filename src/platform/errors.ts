import { Data } from "effect";

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly resource: string;
  readonly id?: string;
  readonly message: string;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
  readonly message: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}> {}

export class UpstreamError extends Data.TaggedError("UpstreamError")<{
  readonly service: "python" | "zvid" | "drive";
  readonly status?: number;
  readonly message: string;
}> {}

export class PersistenceError extends Data.TaggedError("PersistenceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class ConfigError extends Data.TaggedError("ConfigError")<{
  readonly message: string;
}> {}

export type PlatformError =
  | NotFoundError
  | UnauthorizedError
  | ForbiddenError
  | ValidationError
  | UpstreamError
  | PersistenceError
  | StorageError
  | ConfigError;
