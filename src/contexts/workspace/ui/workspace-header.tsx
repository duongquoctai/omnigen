"use client";

import { Film, Share2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { UserAvatarMenu, type UserAvatarMenuUser } from "@/contexts/access";
import { IconButton, type StudioBreadcrumbItem, StudioBreadcrumbs, Text } from "@/shared/ui";

export interface WorkspaceHeaderProps {
  readonly breadcrumbs?: ReadonlyArray<StudioBreadcrumbItem> | undefined;
  readonly statusBadge?: ReactNode | undefined;
  readonly onOpenShare?: (() => void) | undefined;
  readonly currentUser?: UserAvatarMenuUser | null | undefined;
  readonly showProjectsShortcut?: boolean | undefined;
  readonly onLogout?: (() => Promise<unknown>) | undefined;
}

export function WorkspaceHeader({
  breadcrumbs = [],
  statusBadge,
  onOpenShare,
  currentUser = null,
  showProjectsShortcut = false,
  onLogout,
}: WorkspaceHeaderProps) {
  const hasBreadcrumbs = breadcrumbs.length > 0;

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-zinc-800/70 bg-[#04050c]/95 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90"
            title="Về trang chủ OmniGen"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-rose-500 to-indigo-500 shadow-lg shadow-rose-500/20">
              <Film className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 leading-tight">
              <Text
                as="div"
                variant="body"
                className="text-[15px] font-semibold tracking-[-0.02em] text-zinc-100"
              >
                OmniGen
              </Text>
              {!hasBreadcrumbs ? (
                <Text
                  variant="caption"
                  className="hidden text-[11px] font-normal text-zinc-400 sm:block"
                >
                  Hệ thống chỉnh sửa &amp; sản xuất video hàng loạt
                </Text>
              ) : null}
            </div>
          </Link>

          {hasBreadcrumbs ? (
            <>
              <span aria-hidden="true" className="h-4 w-px shrink-0 bg-zinc-800" />
              <StudioBreadcrumbs items={breadcrumbs} className="min-w-0 truncate text-xs" />
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {statusBadge}
          {onOpenShare ? (
            <IconButton
              aria-label="Chia sẻ dự án"
              variant="secondary"
              size="sm"
              onPress={onOpenShare}
              className="h-8 w-8 border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            >
              <Share2 className="h-4 w-4" />
            </IconButton>
          ) : null}
          <UserAvatarMenu
            user={currentUser}
            showProjectsShortcut={showProjectsShortcut}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
}
