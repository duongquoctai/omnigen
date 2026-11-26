import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  type AccessRole,
  accessRoleFromLegacy,
  canManageFolders,
  canPerform,
  canViewModule,
  firstAllowedTab,
  MODULE_ACTIONS,
  STUDIO_MODULES,
} from "../permissions";

describe("access/domain/permissions", () => {
  it("grants Owner all actions on all modules", () => {
    const owner: AccessRole = { _tag: "Owner" };
    fc.assert(
      fc.property(
        fc.constantFrom(...STUDIO_MODULES),
        fc.constantFrom(...MODULE_ACTIONS),
        (mod, act) => {
          expect(canPerform(owner, mod, act)).toBe(true);
        },
      ),
    );
    expect(canManageFolders(owner)).toBe(true);
  });

  it("denies NoAccess all actions on all modules", () => {
    const none: AccessRole = { _tag: "NoAccess" };
    fc.assert(
      fc.property(
        fc.constantFrom(...STUDIO_MODULES),
        fc.constantFrom(...MODULE_ACTIONS),
        (mod, act) => {
          expect(canPerform(none, mod, act)).toBe(false);
        },
      ),
    );
    expect(canManageFolders(none)).toBe(false);
  });

  it("checks Collaborator per-module permissions and derives canManageFolders & firstAllowedTab", () => {
    const collab: AccessRole = {
      _tag: "Collaborator",
      permissions: {
        split: { _tag: "Disabled" },
        mix: { _tag: "Enabled", actions: ["view", "export"] },
        history: { _tag: "Enabled", actions: ["view", "edit"] },
      },
    };

    expect(canViewModule(collab, "split")).toBe(false);
    expect(canViewModule(collab, "mix")).toBe(true);
    expect(canPerform(collab, "mix", "edit")).toBe(false);
    expect(canPerform(collab, "history", "edit")).toBe(true);
    expect(canManageFolders(collab)).toBe(true);
    expect(firstAllowedTab(collab)).toBe("mix");
  });

  it("maps legacy ProjectAccessInfo accurately", () => {
    expect(
      accessRoleFromLegacy({
        role: "owner",
        isOwner: true,
        permissions: {},
      }),
    ).toEqual({ _tag: "Owner" });

    expect(
      accessRoleFromLegacy({
        role: "none",
        isOwner: false,
        permissions: {},
      }),
    ).toEqual({ _tag: "NoAccess" });

    const mapped = accessRoleFromLegacy({
      role: "shared",
      isOwner: false,
      permissions: {
        split: { enabled: true, actions: ["view"] },
        mix: { enabled: false, actions: ["view"] },
        history: { enabled: true, actions: [] },
      },
    });
    expect(mapped._tag).toBe("Collaborator");
    expect(canPerform(mapped, "split", "view")).toBe(true);
    expect(canPerform(mapped, "mix", "view")).toBe(false);
    expect(canPerform(mapped, "history", "view")).toBe(false);
  });
});
