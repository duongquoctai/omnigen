import { Data } from "effect";

export class SplitPointOutOfRange extends Data.TaggedError("SplitPointOutOfRange")<{
  readonly shotId: string;
  readonly message: string;
}> {}

export class ShotNotFound extends Data.TaggedError("ShotNotFound")<{
  readonly shotId: string;
  readonly message: string;
}> {}

export class NoNextShotToMerge extends Data.TaggedError("NoNextShotToMerge")<{
  readonly shotId: string;
  readonly message: string;
}> {}

export class UnclassifiedShotError extends Data.TaggedError("UnclassifiedShotError")<{
  readonly shotId: string;
  readonly message: string;
}> {}

export class SceneDetectionFailed extends Data.TaggedError("SceneDetectionFailed")<{
  readonly message: string;
}> {}

export class SlicingFailed extends Data.TaggedError("SlicingFailed")<{
  readonly message: string;
}> {}

export type FootageDomainError =
  | SplitPointOutOfRange
  | ShotNotFound
  | NoNextShotToMerge
  | UnclassifiedShotError
  | SceneDetectionFailed
  | SlicingFailed;
