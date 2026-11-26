"use client";

import { FolderKanban, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { UserSafeProfile } from "@/types/lachvid";

interface UserAvatarMenuProps {
  user?: UserSafeProfile | null;
  showProjectsShortcut?: boolean;
}

export function getUserInitials(name?: string, email?: string): string {
  const cleanName = (name || "").trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0][0];
      const last = parts[parts.length - 1][0];
      return (first + last).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return parts[0].toUpperCase();
    }
  }

  const cleanEmail = (email || "").trim();
  if (cleanEmail) {
    const handle = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    if (handle.length >= 2) {
      return handle.slice(0, 2).toUpperCase();
    }
    if (handle.length === 1) {
      return handle.toUpperCase();
    }
  }

  return "OG";
}

export default function UserAvatarMenu({
  user: propUser,
  showProjectsShortcut = false,
}: UserAvatarMenuProps) {
  const router = useRouter();
  const [fetchedUser, setFetchedUser] = useState<UserSafeProfile | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const user = propUser || fetchedUser;

  useEffect(() => {
    if (propUser) return;

    let ignore = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.user) {
          setFetchedUser(data.user);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [propUser]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setIsLoggingOut(false);
      setIsOpen(false);
    }
  };

  const initials = getUserInitials(user?.name, user?.email);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Vòng tròn Avatar bấm để toggle dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-600 text-xs font-extrabold tracking-wider text-white shadow-lg shadow-indigo-600/25 transition-all select-none hover:scale-105 hover:bg-indigo-500 focus:outline-none active:scale-95"
        title={user ? `${user.name} (${user.email})` : "Tài khoản cá nhân"}
        aria-label="Menu tài khoản"
      >
        <span>{initials}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="animate-in fade-in zoom-in-95 absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-900 p-2 shadow-2xl duration-150">
          {/* Header thông tin người dùng */}
          <div className="flex items-center gap-2.5 border-b border-slate-800/80 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-600/20 text-[11px] font-bold text-indigo-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-white">{user?.name || "Người dùng"}</p>
              <p className="truncate font-mono text-[11px] text-slate-400">
                {user?.email || "Chưa xác thực"}
              </p>
            </div>
          </div>

          <div className="space-y-1 p-1">
            {/* Lối tắt quay về Danh sách dự án (nếu đang ở trang con) */}
            {showProjectsShortcut && (
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
              >
                <FolderKanban className="h-4 w-4 text-indigo-400" />
                <span>Danh sách dự án</span>
              </Link>
            )}

            {/* Nút Đăng xuất */}
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 text-rose-400" />
              <span>{isLoggingOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
