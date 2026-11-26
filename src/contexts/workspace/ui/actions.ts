"use server";

import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { revalidatePath } from "next/cache";

import { FolderId, ProjectId, type UserId } from "@/contexts/shared-kernel";
import { makeAction } from "@/platform/run";
import { AppLayer } from "@/platform/runtime";

import { FolderRepoLive, FolderRepoTag } from "../adapters/folder-repo";
import { ProjectRepoLive, ProjectRepoTag } from "../adapters/project-repo";
import {
  CreateFolderInput,
  CreateProjectInput,
  RenameFolderInput,
  RenameProjectInput,
} from "../domain/schemas";

const WorkspaceLayer = Layer.mergeAll(
  AppLayer,
  ProjectRepoLive.pipe(Layer.provide(AppLayer)),
  FolderRepoLive.pipe(Layer.provide(AppLayer)),
);

const workspaceRuntime = ManagedRuntime.make(WorkspaceLayer);

const CreateProjectWithOwnerInput = Schema.Struct({
  name: CreateProjectInput.fields.name,
  description: CreateProjectInput.fields.description,
  ownerId: Schema.NonEmptyString,
});

export const createProjectAction = makeAction(
  CreateProjectWithOwnerInput,
  (input) =>
    Effect.gen(function* () {
      const repo = yield* ProjectRepoTag;
      const created = yield* repo.create({
        name: input.name.trim(),
        description: (input.description ?? "").trim(),
        ownerId: input.ownerId as UserId,
      });
      revalidatePath("/");
      return created;
    }),
  workspaceRuntime,
);

export const renameProjectAction = makeAction(
  RenameProjectInput,
  (input) =>
    Effect.gen(function* () {
      const repo = yield* ProjectRepoTag;
      const trimmedName = input.name.trim();
      const trimmedDesc = input.description !== undefined ? input.description.trim() : undefined;
      yield* repo.rename({
        id: input.id,
        name: trimmedName,
        description: trimmedDesc,
      });
      revalidatePath("/");
      revalidatePath(`/projects/${input.id}`);
      return { id: input.id, name: trimmedName, description: trimmedDesc };
    }),
  workspaceRuntime,
);

const DeleteProjectInput = Schema.Struct({
  id: ProjectId,
});

export const deleteProjectAction = makeAction(
  DeleteProjectInput,
  (input) =>
    Effect.gen(function* () {
      const repo = yield* ProjectRepoTag;
      yield* repo.remove(input.id);
      revalidatePath("/");
      return { deletedId: input.id };
    }),
  workspaceRuntime,
);

export const createFolderAction = makeAction(
  CreateFolderInput,
  (input) =>
    Effect.gen(function* () {
      const repo = yield* FolderRepoTag;
      const created = yield* repo.create({
        projectId: input.projectId,
        name: input.name.trim(),
        description: (input.description ?? "").trim(),
      });
      revalidatePath(`/projects/${input.projectId}`);
      return created;
    }),
  workspaceRuntime,
);

export const renameFolderAction = makeAction(
  RenameFolderInput,
  (input) =>
    Effect.gen(function* () {
      const repo = yield* FolderRepoTag;
      yield* repo.rename({ id: input.id, name: input.name.trim() });
      revalidatePath(`/projects/${input.projectId}`);
      return { id: input.id, name: input.name.trim() };
    }),
  workspaceRuntime,
);

const DeleteFolderInput = Schema.Struct({
  id: FolderId,
  projectId: ProjectId,
});

export const deleteFolderAction = makeAction(
  DeleteFolderInput,
  (input) =>
    Effect.gen(function* () {
      const repo = yield* FolderRepoTag;
      yield* repo.remove(input.id);
      revalidatePath(`/projects/${input.projectId}`);
      return { deletedId: input.id };
    }),
  workspaceRuntime,
);
