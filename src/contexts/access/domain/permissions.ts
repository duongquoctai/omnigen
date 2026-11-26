import { Match, Option, Schema } from "effect";

export const STUDIO_MODULES = ["split", "mix", "history"] as const;
export const StudioModule = Schema.Literals(STUDIO_MODULES);
export type StudioModule = typeof StudioModule.Type;

export const MODULE_ACTIONS = ["view", "export", "edit"] as const;
export const ModuleAction = Schema.Literals(MODULE_ACTIONS);
export type ModuleAction = typeof ModuleAction.Type;

export const ModulePermission = Schema.Union([
  Schema.TaggedStruct("Disabled", {}),
  Schema.TaggedStruct("Enabled", {
    actions: Schema.NonEmptyArray(ModuleAction),
  }),
]);
export type ModulePermission = typeof ModulePermission.Type;

export const ModulePermissions = Schema.Struct({
  split: ModulePermission,
  mix: ModulePermission,
  history: ModulePermission,
});
export type ModulePermissions = typeof ModulePermissions.Type;

export const AccessRole = Schema.Union([
  Schema.TaggedStruct("Owner", {}),
  Schema.TaggedStruct("Collaborator", {
    permissions: ModulePermissions,
  }),
  Schema.TaggedStruct("NoAccess", {}),
]);
export type AccessRole = typeof AccessRole.Type;

export const canPerform = (
  role: AccessRole,
  studioModule: StudioModule,
  action: ModuleAction,
): boolean =>
  Match.value(role).pipe(
    Match.tag("Owner", () => true),
    Match.tag("NoAccess", () => false),
    Match.tag("Collaborator", ({ permissions }) => {
      const mod = permissions[studioModule];
      return Match.value(mod).pipe(
        Match.tag("Disabled", () => false),
        Match.tag("Enabled", ({ actions }) => actions.includes(action)),
        Match.exhaustive,
      );
    }),
    Match.exhaustive,
  );

export const canViewModule = (role: AccessRole, studioModule: StudioModule): boolean =>
  canPerform(role, studioModule, "view");

export const canManageFolders = (role: AccessRole): boolean =>
  STUDIO_MODULES.some((mod) => canPerform(role, mod, "edit"));

export const firstAllowedTab = (role: AccessRole): StudioModule => {
  const found = STUDIO_MODULES.find((mod) => canViewModule(role, mod));
  return found ?? "split";
};

export interface LegacyProjectAccessInfo {
  readonly role: "owner" | "shared" | "none";
  readonly isOwner: boolean;
  readonly permissions: {
    readonly split?: { readonly enabled: boolean; readonly actions: ReadonlyArray<string> };
    readonly mix?: { readonly enabled: boolean; readonly actions: ReadonlyArray<string> };
    readonly history?: { readonly enabled: boolean; readonly actions: ReadonlyArray<string> };
  };
}

const toModulePermission = (raw?: {
  readonly enabled: boolean;
  readonly actions: ReadonlyArray<string>;
}): ModulePermission => {
  if (!raw || !raw.enabled) {
    return { _tag: "Disabled" };
  }
  const validActions = raw.actions.filter(
    (a): a is ModuleAction => a === "view" || a === "export" || a === "edit",
  );
  return Option.match(
    Schema.decodeUnknownOption(Schema.NonEmptyArray(ModuleAction))(validActions),
    {
      onNone: () => ({ _tag: "Disabled" }),
      onSome: (actions) => ({ _tag: "Enabled", actions }),
    },
  );
};

export const accessRoleFromLegacy = (legacy: LegacyProjectAccessInfo): AccessRole => {
  if (legacy.role === "owner" || legacy.isOwner) {
    return { _tag: "Owner" };
  }
  if (legacy.role === "none") {
    return { _tag: "NoAccess" };
  }
  return {
    _tag: "Collaborator",
    permissions: {
      split: toModulePermission(legacy.permissions.split),
      mix: toModulePermission(legacy.permissions.mix),
      history: toModulePermission(legacy.permissions.history),
    },
  };
};
