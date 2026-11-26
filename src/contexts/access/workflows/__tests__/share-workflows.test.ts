import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { UserId } from "@/contexts/shared-kernel";

import { DEFAULT_MODULE_PERMISSIONS } from "../../domain/sharing";
import { CurrentUserPort, ShareRepo } from "../ports";
import {
  listProjectSharesWorkflow,
  removeProjectShareWorkflow,
  shareProjectWorkflow,
} from "../share-workflows";

const makeTestLayers = (options?: {
  readonly user?: Option.Option<{ id: UserId; email: string; name: string }>;
  readonly isOwner?: boolean;
  readonly removeResult?: boolean;
}) => {
  const userOpt =
    options?.user ??
    Option.some({
      id: UserId.make("u_owner"),
      email: "owner@example.com",
      name: "Owner",
    });

  const userLayer = Layer.succeed(CurrentUserPort, {
    getCurrentUser: () => Effect.succeed(userOpt),
  });

  const shareItem = {
    id: "shr_1",
    projectId: "proj_1",
    sharedWithEmail: "member@example.com",
    sharedWithUserId: "u_member",
    sharedUserName: "Member",
    permissions: DEFAULT_MODULE_PERMISSIONS,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const repoLayer = Layer.succeed(ShareRepo, {
    isProjectOwner: () => Effect.succeed(options?.isOwner ?? true),
    listShares: () => Effect.succeed([shareItem]),
    upsertShare: ({ targetEmail, permissions }) =>
      Effect.succeed({
        ...shareItem,
        sharedWithEmail: targetEmail,
        permissions,
      }),
    removeShare: () => Effect.succeed(options?.removeResult ?? true),
    listShareableUsers: () =>
      Effect.succeed([{ id: "u_member", email: "member@example.com", name: "Member" }]),
  });

  return Layer.mergeAll(userLayer, repoLayer);
};

describe("access/workflows/share-workflows", () => {
  it.effect("lists shares and shareable users for owner", () =>
    listProjectSharesWorkflow({ projectId: "proj_1" }).pipe(
      Effect.provide(makeTestLayers()),
      Effect.map((result) => {
        expect(result.shares).toHaveLength(1);
        expect(result.users).toHaveLength(1);
      }),
    ),
  );

  it.effect("rejects non-owner or self-sharing or invalid email", () =>
    Effect.gen(function* () {
      const forbidden = yield* listProjectSharesWorkflow({
        projectId: "proj_1",
      }).pipe(Effect.provide(makeTestLayers({ isOwner: false })), Effect.flip);
      expect(forbidden._tag).toBe("ForbiddenError");

      const selfErr = yield* shareProjectWorkflow({
        projectId: "proj_1",
        email: "OWNER@example.com",
        permissions: DEFAULT_MODULE_PERMISSIONS,
      }).pipe(Effect.provide(makeTestLayers()), Effect.flip);
      expect(selfErr._tag).toBe("ValidationError");

      const badEmail = yield* shareProjectWorkflow({
        projectId: "proj_1",
        email: "not-an-email",
        permissions: DEFAULT_MODULE_PERMISSIONS,
      }).pipe(Effect.provide(makeTestLayers()), Effect.flip);
      expect(badEmail._tag).toBe("ValidationError");
    }),
  );

  it.effect("shares project and removes share for owner", () =>
    Effect.gen(function* () {
      const shared = yield* shareProjectWorkflow({
        projectId: "proj_1",
        email: "member@example.com",
        permissions: DEFAULT_MODULE_PERMISSIONS,
      }).pipe(Effect.provide(makeTestLayers()));
      expect(shared.sharedWithEmail).toBe("member@example.com");

      const removed = yield* removeProjectShareWorkflow({
        projectId: "proj_1",
        shareId: "shr_1",
      }).pipe(Effect.provide(makeTestLayers()));
      expect(removed.shareId).toBe("shr_1");

      const notFound = yield* removeProjectShareWorkflow({
        projectId: "proj_1",
        shareId: "missing",
      }).pipe(Effect.provide(makeTestLayers({ removeResult: false })), Effect.flip);
      expect(notFound._tag).toBe("NotFoundError");
    }),
  );
});
