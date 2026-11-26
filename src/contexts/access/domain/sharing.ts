import { Match, Option, Schema } from "effect";

import {
  ModuleAction,
  type ModulePermission,
  ModulePermissions,
  type StudioModule,
} from "./permissions";

export const ShareableUser = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
});
export type ShareableUser = typeof ShareableUser.Type;

export const ProjectShareItem = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  sharedWithEmail: Schema.String,
  sharedWithUserId: Schema.NullOr(Schema.String),
  sharedUserName: Schema.NullOr(Schema.String),
  permissions: ModulePermissions,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type ProjectShareItem = typeof ProjectShareItem.Type;

export const ListSharesInput = Schema.Struct({
  projectId: Schema.String.check(Schema.isMinLength(1)),
});
export type ListSharesInput = typeof ListSharesInput.Type;

export const ShareProjectInput = Schema.Struct({
  projectId: Schema.String.check(Schema.isMinLength(1)),
  email: Schema.String.check(Schema.isMinLength(1)),
  permissions: ModulePermissions,
});
export type ShareProjectInput = typeof ShareProjectInput.Type;

export const RemoveShareInput = Schema.Struct({
  projectId: Schema.String.check(Schema.isMinLength(1)),
  shareId: Schema.String.check(Schema.isMinLength(1)),
});
export type RemoveShareInput = typeof RemoveShareInput.Type;

export const DEFAULT_MODULE_PERMISSIONS: ModulePermissions = {
  split: { _tag: "Enabled", actions: ["view", "export"] },
  mix: { _tag: "Enabled", actions: ["view", "export"] },
  history: { _tag: "Enabled", actions: ["view", "export"] },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidShareEmail = (email: string): boolean =>
  EMAIL_PATTERN.test(email.trim().toLowerCase());

const extractActions = (permission: ModulePermission): ReadonlyArray<ModuleAction> =>
  Match.value(permission).pipe(
    Match.tag("Disabled", () => []),
    Match.tag("Enabled", ({ actions }) => actions),
    Match.exhaustive,
  );

const toModulePermissionFromActions = (actions: ReadonlyArray<ModuleAction>): ModulePermission =>
  Option.match(
    Schema.decodeUnknownOption(Schema.NonEmptyArray(ModuleAction))(Array.from(new Set(actions))),
    {
      onNone: () => ({ _tag: "Disabled" }),
      onSome: (nonEmpty) => ({ _tag: "Enabled", actions: nonEmpty }),
    },
  );

export const toggleModuleAction = (
  permissions: ModulePermissions,
  studioModule: StudioModule,
  action: ModuleAction,
): ModulePermissions => {
  const currentActions = extractActions(permissions[studioModule]);
  const hasAction = currentActions.includes(action);

  const nextActions: ReadonlyArray<ModuleAction> = hasAction
    ? action === "view"
      ? []
      : currentActions.filter((item) => item !== action)
    : action === "edit" || action === "export"
      ? [...currentActions, action, "view"]
      : [...currentActions, action];

  return {
    ...permissions,
    [studioModule]: toModulePermissionFromActions(nextActions),
  };
};

export const toggleModuleEnabled = (
  permissions: ModulePermissions,
  studioModule: StudioModule,
): ModulePermissions => {
  const nextPermission: ModulePermission = Match.value(permissions[studioModule]).pipe(
    Match.tag("Enabled", () => ({ _tag: "Disabled" as const })),
    Match.tag("Disabled", () => ({
      _tag: "Enabled" as const,
      actions: ["view", "export"] as const,
    })),
    Match.exhaustive,
  );
  return {
    ...permissions,
    [studioModule]: nextPermission,
  };
};

export const filterShareableUsers = (
  users: ReadonlyArray<ShareableUser>,
  sharedEmails: ReadonlySet<string>,
  query: string,
): ReadonlyArray<ShareableUser> => {
  const normalizedQuery = query.trim().toLowerCase();
  return users.filter((user) => {
    if (sharedEmails.has(user.email.toLowerCase().trim())) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return (
      user.email.toLowerCase().includes(normalizedQuery) ||
      user.name.toLowerCase().includes(normalizedQuery)
    );
  });
};

export interface LegacyModulePermissionShape {
  readonly enabled: boolean;
  readonly actions: ReadonlyArray<string>;
}

export interface LegacySharePermissionsShape {
  readonly split?: LegacyModulePermissionShape;
  readonly mix?: LegacyModulePermissionShape;
  readonly history?: LegacyModulePermissionShape;
}

const fromLegacyModule = (raw?: LegacyModulePermissionShape): ModulePermission => {
  if (!raw || !raw.enabled) {
    return { _tag: "Disabled" };
  }
  const valid = raw.actions.filter(
    (item): item is ModuleAction => item === "view" || item === "export" || item === "edit",
  );
  return toModulePermissionFromActions(valid);
};

export const modulePermissionsFromLegacy = (
  legacy: LegacySharePermissionsShape,
): ModulePermissions => ({
  split: fromLegacyModule(legacy.split),
  mix: fromLegacyModule(legacy.mix),
  history: fromLegacyModule(legacy.history),
});

const toLegacyModule = (permission: ModulePermission): LegacyModulePermissionShape =>
  Match.value(permission).pipe(
    Match.tag("Disabled", () => ({ enabled: false, actions: [] })),
    Match.tag("Enabled", ({ actions }) => ({
      enabled: true,
      actions: [...actions],
    })),
    Match.exhaustive,
  );

export const modulePermissionsToLegacy = (
  permissions: ModulePermissions,
): {
  readonly split: LegacyModulePermissionShape;
  readonly mix: LegacyModulePermissionShape;
  readonly history: LegacyModulePermissionShape;
} => ({
  split: toLegacyModule(permissions.split),
  mix: toLegacyModule(permissions.mix),
  history: toLegacyModule(permissions.history),
});

export const getUserInitials = (name?: string | null, email?: string | null): string => {
  const source = Option.fromNullishOr(name).pipe(
    Option.map((n) => n.trim()),
    Option.filter((n) => n.length > 0),
    Option.getOrElse(() => (email ?? "U").trim()),
  );
  const parts = source.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "U";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "U";
};
