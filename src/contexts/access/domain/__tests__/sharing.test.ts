import { describe, expect, it } from "vitest";

import {
  DEFAULT_MODULE_PERMISSIONS,
  filterShareableUsers,
  getUserInitials,
  isValidShareEmail,
  modulePermissionsFromLegacy,
  modulePermissionsToLegacy,
  toggleModuleAction,
  toggleModuleEnabled,
} from "../sharing";

describe("access/domain/sharing", () => {
  it("toggles module actions with view dependency rules", () => {
    const disabled = toggleModuleEnabled(DEFAULT_MODULE_PERMISSIONS, "split");
    expect(disabled.split).toEqual({ _tag: "Disabled" });

    const enabledEdit = toggleModuleAction(disabled, "split", "edit");
    expect(enabledEdit.split).toEqual({
      _tag: "Enabled",
      actions: ["edit", "view"],
    });

    const clearedByView = toggleModuleAction(enabledEdit, "split", "view");
    expect(clearedByView.split).toEqual({ _tag: "Disabled" });

    const reEnabled = toggleModuleEnabled(clearedByView, "split");
    expect(reEnabled.split).toEqual({
      _tag: "Enabled",
      actions: ["view", "export"],
    });
  });

  it("filters shareable users excluding already shared emails", () => {
    const users = [
      { id: "u1", email: "alice@example.com", name: "Alice" },
      { id: "u2", email: "bob@example.com", name: "Bob Tran" },
    ];
    const shared = new Set(["alice@example.com"]);

    expect(filterShareableUsers(users, shared, "")).toEqual([users[1]]);
    expect(filterShareableUsers(users, shared, "tran")).toEqual([users[1]]);
    expect(filterShareableUsers(users, shared, "charlie")).toEqual([]);
  });

  it("converts legacy share permissions round-trip and validates email/initials", () => {
    const legacy = modulePermissionsToLegacy(DEFAULT_MODULE_PERMISSIONS);
    expect(modulePermissionsFromLegacy(legacy)).toEqual(DEFAULT_MODULE_PERMISSIONS);
    expect(isValidShareEmail("member@example.com")).toBe(true);
    expect(isValidShareEmail("invalid-email")).toBe(false);
    expect(getUserInitials("Nguyen Van A", "a@example.com")).toBe("NA");
    expect(getUserInitials(null, "alice@example.com")).toBe("AL");
  });
});
