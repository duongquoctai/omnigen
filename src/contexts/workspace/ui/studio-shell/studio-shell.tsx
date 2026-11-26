"use client";

import type { ReactNode } from "react";

import type { AccessRole } from "@/contexts/access";

import { PermissionProvider } from "./permission-context";
import { ToastProvider } from "./toast-context";

export interface StudioShellProps {
  readonly accessRole: AccessRole;
  readonly children: ReactNode;
}

export function StudioShell({ accessRole, children }: StudioShellProps) {
  return (
    <ToastProvider>
      <PermissionProvider role={accessRole}>{children}</PermissionProvider>
    </ToastProvider>
  );
}
