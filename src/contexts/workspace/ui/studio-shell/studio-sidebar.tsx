"use client";

import { Film, FolderOpen, History, Layers, Menu, Scissors } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, IconButton, StudioDrawer, Text } from "@/shared/ui";

import type { StudioTab } from "./studio-tab";

export interface SidebarFolderItem {
  readonly id: string;
  readonly name: string;
}

export interface StudioSidebarProps {
  readonly activeTab: StudioTab;
  readonly visibleTabs: ReadonlyArray<{ readonly id: StudioTab; readonly label: string }>;
  readonly onSelectTab: (tab: StudioTab) => void;
  readonly renderedCount: number;
  readonly parentProjectId: string;
  readonly parentProjectName: string;
  readonly currentFolderId: string;
  readonly siblingFolders: ReadonlyArray<SidebarFolderItem>;
}

const RAIL_LABELS: Record<StudioTab, string> = {
  split: "Tách video",
  mix: "Trộn ghép",
  history: "Lịch sử...",
};

export function StudioSidebar({
  activeTab,
  visibleTabs,
  onSelectTab,
  renderedCount,
  parentProjectId,
  parentProjectName,
  currentFolderId,
  siblingFolders,
}: StudioSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <aside className="sticky top-0 flex h-screen w-18 shrink-0 flex-col items-center gap-4 bg-[#04050c] py-3">
        <IconButton
          aria-label="Mở danh sách thư mục"
          variant="ghost"
          size="sm"
          onPress={() => {
            setDrawerOpen(true);
          }}
        >
          <Menu className="h-4 w-4 text-zinc-300" />
        </IconButton>

        <Link
          href="/"
          title="Về trang chủ OmniGen"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-500 text-white shadow-lg shadow-rose-500/20 transition hover:opacity-90"
        >
          <Film className="h-5 w-5" />
        </Link>

        <nav
          aria-label="Điều hướng studio"
          className="mt-2 flex w-full flex-col items-center gap-2 px-1.5"
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const icon =
              tab.id === "split" ? (
                <Scissors className="h-4 w-4 shrink-0" />
              ) : tab.id === "mix" ? (
                <Layers className="h-4 w-4 shrink-0" />
              ) : (
                <History className="h-4 w-4 shrink-0" />
              );

            return (
              <div key={tab.id} className="relative w-full">
                <Button
                  fullWidth
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    onSelectTab(tab.id);
                  }}
                  className={`flex h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition ${
                    isActive
                      ? "!border-indigo-500 !bg-indigo-500/10 !text-indigo-400"
                      : "border-transparent text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                  }`}
                >
                  {icon}
                  <Text
                    variant="caption"
                    className={`max-w-full truncate text-[10px] font-medium ${
                      isActive ? "!text-indigo-400" : "text-inherit"
                    }`}
                  >
                    {RAIL_LABELS[tab.id]}
                  </Text>
                </Button>

                {tab.id === "history" && renderedCount > 0 ? (
                  <span className="pointer-events-none absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white shadow">
                    {renderedCount > 99 ? "99+" : renderedCount}
                  </span>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <StudioDrawer isOpen={drawerOpen} onOpenChange={setDrawerOpen} title={parentProjectName}>
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white"
          >
            ← Tất cả dự án
          </Link>
          <Text variant="label" className="mt-2 text-zinc-400">
            Thư mục trong dự án
          </Text>
          {siblingFolders.map((folder) => {
            const isCurrent = folder.id === currentFolderId;
            return (
              <Link
                key={folder.id}
                href={`/projects/${parentProjectId}/folders/${folder.id}`}
                onClick={() => {
                  setDrawerOpen(false);
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                  isCurrent
                    ? "border-indigo-500/50 bg-indigo-500/15 font-semibold text-white"
                    : "border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700 hover:text-white"
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5 text-indigo-400" />
                <span className="truncate">{folder.name}</span>
              </Link>
            );
          })}
        </div>
      </StudioDrawer>
    </>
  );
}
