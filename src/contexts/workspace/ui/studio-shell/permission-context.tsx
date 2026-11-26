"use client";

import { createContext, type ReactNode, useCallback, useContext } from "react";

import {
  type AccessRole,
  canManageFolders,
  canPerform,
  type ModuleAction,
  type StudioModule,
} from "@/contexts/access";

import { useToast } from "./toast-context";

interface PermissionContextValue {
  readonly role: AccessRole;
  readonly can: (studioModule: StudioModule, action: ModuleAction) => boolean;
  readonly canManageFolders: boolean;
  readonly notifyDenied: (actionLabel?: string) => void;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  role,
  children,
}: {
  readonly role: AccessRole;
  readonly children: ReactNode;
}) {
  const { addToast } = useToast();

  const can = useCallback(
    (studioModule: StudioModule, action: ModuleAction) => canPerform(role, studioModule, action),
    [role],
  );

  const notifyDenied = useCallback(
    (actionLabel?: string) => {
      addToast(
        "error",
        actionLabel
          ? `Bạn không có quyền ${actionLabel} trong thư mục này.`
          : "Bạn không có quyền thực hiện thao tác này.",
      );
    },
    [addToast],
  );

  return (
    <PermissionContext.Provider
      value={{
        role,
        can,
        canManageFolders: canManageFolders(role),
        notifyDenied,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermission(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermission must be used within PermissionProvider");
  }
  return ctx;
}
