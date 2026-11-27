import { Effect, Option } from "effect";

import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@/platform/errors";

import {
  isValidShareEmail,
  type ListSharesInput,
  type ProjectShareItem,
  type RemoveShareInput,
  type ShareableUser,
  type ShareProjectInput,
} from "../domain/sharing";
import { CurrentUserPort, ShareRepo } from "./ports";

export interface ProjectSharesBundle {
  readonly shares: ReadonlyArray<ProjectShareItem>;
  readonly users: ReadonlyArray<ShareableUser>;
}

const requireOwner = (projectId: string, forbiddenMessage: string) =>
  Effect.gen(function* () {
    const currentUserPort = yield* CurrentUserPort;
    const shareRepo = yield* ShareRepo;

    const currentUserOpt = yield* currentUserPort.getCurrentUser();
    if (Option.isNone(currentUserOpt)) {
      return yield* Effect.fail(new UnauthorizedError({ message: "Chưa đăng nhập." }));
    }

    const user = currentUserOpt.value;
    const isOwner = yield* shareRepo.isProjectOwner(projectId, user.id);
    if (!isOwner) {
      return yield* Effect.fail(new ForbiddenError({ message: forbiddenMessage }));
    }

    return user;
  });

export const listProjectSharesWorkflow = (input: ListSharesInput) =>
  Effect.gen(function* () {
    const shareRepo = yield* ShareRepo;
    const currentUser = yield* requireOwner(
      input.projectId,
      "Chỉ chủ sở hữu dự án mới có quyền xem danh sách chia sẻ.",
    );

    const [shares, allUsers] = yield* Effect.all([
      shareRepo.listShares(input.projectId),
      shareRepo.listShareableUsers(),
    ]);

    const currentEmail = currentUser.email.trim().toLowerCase();
    const users = allUsers.filter(
      (u) => u.id !== currentUser.id && u.email.trim().toLowerCase() !== currentEmail,
    );

    return { shares, users } satisfies ProjectSharesBundle;
  });

export const shareProjectWorkflow = (input: ShareProjectInput) =>
  Effect.gen(function* () {
    const shareRepo = yield* ShareRepo;
    const user = yield* requireOwner(
      input.projectId,
      "Chỉ chủ sở hữu dự án mới có quyền chia sẻ dự án này.",
    );

    const normalizedEmail = input.email.trim().toLowerCase();
    if (!normalizedEmail) {
      return yield* Effect.fail(
        new ValidationError({ message: "Vui lòng nhập email người nhận." }),
      );
    }

    if (normalizedEmail === user.email.trim().toLowerCase()) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Bạn không thể tự chia sẻ dự án cho chính mình.",
        }),
      );
    }

    if (!isValidShareEmail(normalizedEmail)) {
      return yield* Effect.fail(new ValidationError({ message: "Định dạng email không hợp lệ." }));
    }

    return yield* shareRepo.upsertShare({
      ownerId: user.id,
      projectId: input.projectId,
      targetEmail: normalizedEmail,
      permissions: input.permissions,
    });
  });

export const removeProjectShareWorkflow = (input: RemoveShareInput) =>
  Effect.gen(function* () {
    const shareRepo = yield* ShareRepo;
    const user = yield* requireOwner(
      input.projectId,
      "Chỉ chủ sở hữu dự án mới có quyền thu hồi chia sẻ.",
    );

    const removed = yield* shareRepo.removeShare(input.shareId, user.id);
    if (!removed) {
      return yield* Effect.fail(
        new NotFoundError({
          resource: "share",
          id: input.shareId,
          message: "Không tìm thấy quyền chia sẻ hoặc bạn không có quyền xoá.",
        }),
      );
    }

    return { shareId: input.shareId } as const;
  });
