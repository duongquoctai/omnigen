"use client";

import { History, Layers, Scissors } from "lucide-react";

import { Button, Text } from "@/shared/ui";

import type { StudioTab } from "./studio-tab";

export interface StudioSidebarProps {
  readonly activeTab: StudioTab;
  readonly visibleTabs: ReadonlyArray<{ readonly id: StudioTab; readonly label: string }>;
  readonly onSelectTab: (tab: StudioTab) => void;
  readonly renderedCount: number;
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
}: StudioSidebarProps) {
  return (
    <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-18 shrink-0 flex-col items-center bg-[#04050c] py-3">
      <nav
        aria-label="Điều hướng studio"
        className="flex w-full flex-col items-center gap-2 px-1.5"
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
                className={`flex h-14 w-full min-w-0 flex-col items-center justify-center gap-1 border px-1 py-2 transition ${
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
  );
}
