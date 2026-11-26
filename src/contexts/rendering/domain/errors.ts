import { Data } from "effect";

export class InvalidJobTransition extends Data.TaggedError("InvalidJobTransition")<{
  readonly jobId: string;
  readonly fromState: string;
  readonly toState: string;
  readonly message: string;
}> {}

export class RenderJobNotFound extends Data.TaggedError("RenderJobNotFound")<{
  readonly id: string;
  readonly message: string;
}> {}

export class RecordNotFound extends Data.TaggedError("RecordNotFound")<{
  readonly recordId: string;
  readonly message: string;
}> {}

export class ZvidValidationFailed extends Data.TaggedError("ZvidValidationFailed")<{
  readonly message: string;
}> {}

export class ZvidSubmitFailed extends Data.TaggedError("ZvidSubmitFailed")<{
  readonly message: string;
}> {}

export class MediaDownloadFailed extends Data.TaggedError("MediaDownloadFailed")<{
  readonly message: string;
}> {}

export type RenderingDomainError =
  | InvalidJobTransition
  | RenderJobNotFound
  | RecordNotFound
  | ZvidValidationFailed
  | ZvidSubmitFailed
  | MediaDownloadFailed;
