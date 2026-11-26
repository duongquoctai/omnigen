import { Data } from "effect";

import type { ShotCategory } from "@/contexts/shared-kernel";

export class LibraryIncomplete extends Data.TaggedError("LibraryIncomplete")<{
  readonly missingCategories: ReadonlyArray<ShotCategory>;
  readonly message: string;
}> {}

export class NotEnoughCombinations extends Data.TaggedError("NotEnoughCombinations")<{
  readonly requested: number;
  readonly generated: number;
  readonly message: string;
}> {}

export class InvalidDriveLink extends Data.TaggedError("InvalidDriveLink")<{
  readonly rawLink: string;
  readonly message: string;
}> {}

export class InvalidDiversityRules extends Data.TaggedError("InvalidDiversityRules")<{
  readonly message: string;
}> {}

export class DriveProbeFailed extends Data.TaggedError("DriveProbeFailed")<{
  readonly fileId: string;
  readonly message: string;
}> {}

export type CompositionDomainError =
  | LibraryIncomplete
  | NotEnoughCombinations
  | InvalidDriveLink
  | InvalidDiversityRules
  | DriveProbeFailed;
