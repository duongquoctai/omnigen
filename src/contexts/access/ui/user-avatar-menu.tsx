"use client";

import { FolderKanban, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Text, UserMenuDropdown, type UserMenuItem } from "@/shared/ui";

import { getUserInitials } from "../domain/sharing";
import { logoutAction } from "./actions";

export interface UserAvatarMenuUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface UserAvatarMenuProps {
  readonly user: UserAvatarMenuUser | null;
  readonly showProjectsShortcut?: boolean | undefined;
  readonly onLogout?: (() => Promise<unknown>) | undefined;
}

export function UserAvatarMenu({
  user,
  showProjectsShortcut = false,
  onLogout,
}: UserAvatarMenuProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
      >
        <UserIcon className="h-3.5 w-3.5" />
        Đăng nhập
      </Link>
    );
  }

  const initials = getUserInitials(user.name, user.email);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await logoutAction({});
      }
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const items: UserMenuItem[] = [
    ...(showProjectsShortcut
      ? [
          {
            id: "projects",
            label: "Quản lý dự án",
            icon: <FolderKanban className="h-3.5 w-3.5 text-indigo-400" />,
            onAction: () => {
              router.push("/");
            },
          },
        ]
      : []),
    {
      id: "logout",
      label: isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất",
      icon: <LogOut className="h-3.5 w-3.5" />,
      isDanger: true,
      onAction: () => {
        void handleLogout();
      },
    },
  ];

  return (
    <UserMenuDropdown
      name={user.name}
      initials={initials}
      headerContent={
        <div className="min-w-0">
          <Text variant="label" className="block truncate text-white">
            {user.name}
          </Text>
          <Text variant="caption" className="block truncate text-[11px] text-zinc-400">
            {user.email}
          </Text>
        </div>
      }
      items={items}
    />
  );
}
