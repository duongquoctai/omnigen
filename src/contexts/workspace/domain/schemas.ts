import { Schema } from "effect";

import { FolderId, ProjectId } from "@/contexts/shared-kernel";

export const CreateProjectInput = Schema.Struct({
  name: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
});
export type CreateProjectInput = typeof CreateProjectInput.Type;

export const RenameProjectInput = Schema.Struct({
  id: ProjectId,
  name: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
});
export type RenameProjectInput = typeof RenameProjectInput.Type;

export const CreateFolderInput = Schema.Struct({
  projectId: ProjectId,
  name: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
});
export type CreateFolderInput = typeof CreateFolderInput.Type;

export const RenameFolderInput = Schema.Struct({
  id: FolderId,
  projectId: ProjectId,
  name: Schema.NonEmptyString,
});
export type RenameFolderInput = typeof RenameFolderInput.Type;
