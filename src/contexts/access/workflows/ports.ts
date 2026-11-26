import { Context, type Effect, type Option } from "effect";

import type { UserId } from "@/contexts/shared-kernel";
import type { PersistenceError } from "@/platform/errors";

import type { TokenPayload } from "../domain/auth";
import type { ModulePermissions } from "../domain/permissions";
import type { ProjectShareItem, ShareableUser } from "../domain/sharing";

export interface AuthUserRecord {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: Option.Option<string>;
}

export class UserRepo extends Context.Service<
  UserRepo,
  {
    readonly findByEmail: (
      email: string,
    ) => Effect.Effect<Option.Option<AuthUserRecord>, PersistenceError>;
    readonly create: (params: {
      readonly name: string;
      readonly email: string;
      readonly passwordHash: string;
    }) => Effect.Effect<AuthUserRecord, PersistenceError>;
  }
>()("access/UserRepo") {}

export class PasswordHasher extends Context.Service<
  PasswordHasher,
  {
    readonly hash: (plain: string) => Effect.Effect<string>;
    readonly verify: (plain: string, hash: string) => Effect.Effect<boolean>;
  }
>()("access/PasswordHasher") {}

export class TokenIssuer extends Context.Service<
  TokenIssuer,
  {
    readonly sign: (payload: Omit<TokenPayload, "exp">) => Effect.Effect<string>;
  }
>()("access/TokenIssuer") {}

export class SessionCookiePort extends Context.Service<
  SessionCookiePort,
  {
    readonly setToken: (token: string) => Effect.Effect<void>;
    readonly clearToken: () => Effect.Effect<void>;
  }
>()("access/SessionCookiePort") {}

export interface CurrentSessionUser {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
}

export class CurrentUserPort extends Context.Service<
  CurrentUserPort,
  {
    readonly getCurrentUser: () => Effect.Effect<Option.Option<CurrentSessionUser>>;
  }
>()("access/CurrentUserPort") {}

export class ShareRepo extends Context.Service<
  ShareRepo,
  {
    readonly isProjectOwner: (
      projectId: string,
      userId: string,
    ) => Effect.Effect<boolean, PersistenceError>;
    readonly listShares: (
      projectId: string,
    ) => Effect.Effect<ReadonlyArray<ProjectShareItem>, PersistenceError>;
    readonly upsertShare: (params: {
      readonly ownerId: string;
      readonly projectId: string;
      readonly targetEmail: string;
      readonly permissions: ModulePermissions;
    }) => Effect.Effect<ProjectShareItem, PersistenceError>;
    readonly removeShare: (
      shareId: string,
      ownerId: string,
    ) => Effect.Effect<boolean, PersistenceError>;
    readonly listShareableUsers: () => Effect.Effect<
      ReadonlyArray<ShareableUser>,
      PersistenceError
    >;
  }
>()("access/ShareRepo") {}
