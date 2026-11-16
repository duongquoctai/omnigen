"use client";

import { Film, History, Menu, Scissors, Shuffle, X } from "lucide-react";
import Link from "next/link";
import React from "react";

export type SidebarWorkspaceTab = "split" | "mix" | "history";

interface GlobalSidebarProps {
  mainTab: SidebarWorkspaceTab;
  onSelectTab: (tab: SidebarWorkspaceTab) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  canViewSplit: boolean;
  canViewMix: boolean;
  canViewHistory: boolean;
  projectRenderedCount: number;
  onHistoryClick?: () => void;
}

export default function GlobalSidebar({
  mainTab,
  onSelectTab,
  isExpanded,
  onToggleExpand,
  isMobileOpen,
  onCloseMobile,
  canViewSplit,
  canViewMix,
  canViewHistory,
  projectRenderedCount,
  onHistoryClick,
}: GlobalSidebarProps) {
  const navItems: Array<{
    id: SidebarWorkspaceTab;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
    badge?: number;
  }> = [
    {
      id: "split",
      label: "Tách video",
      shortLabel: "Tách video",
      icon: Scissors,
      visible: canViewSplit,
    },
    {
      id: "mix",
      label: "Trộn ghép",
      shortLabel: "Trộn ghép",
      icon: Shuffle,
      visible: canViewMix,
    },
    {
      id: "history",
      label: "Lịch sử render",
      shortLabel: "Lịch sử render",
      icon: History,
      visible: canViewHistory,
      badge: projectRenderedCount > 0 ? projectRenderedCount : undefined,
    },
  ];

  const handleSelect = (id: SidebarWorkspaceTab) => {
    onSelectTab(id);
    if (id === "history" && onHistoryClick) {
      onHistoryClick();
    }
    onCloseMobile();
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-slate-950 z-40 select-none transition-[width] duration-300 ease-in-out ${
          isExpanded ? "w-64" : "w-[84px]"
        }`}
      >
        {/* Top Header of Sidebar: Hamburger + Logo + App Description */}
        <div
          className={`transition-all duration-300 ${
            isExpanded
              ? "p-4 space-y-2.5"
              : "py-3.5 px-2 flex flex-col items-center gap-2.5"
          }`}
        >
          <div
            className={`flex items-center ${
              isExpanded ? "gap-3" : "flex-col gap-2"
            }`}
          >
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/90 active:scale-95 transition cursor-pointer shrink-0"
              title={isExpanded ? "Thu gọn thanh bên" : "Mở rộng thanh bên"}
              aria-label={
                isExpanded ? "Thu gọn thanh bên" : "Mở rộng thanh bên"
              }
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link
              href="/"
              className="flex items-center gap-2.5 hover:opacity-90 transition min-w-0"
              title="Về trang chủ OmniGen"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
                <Film className="w-5 h-5 text-white" />
              </div>
              {isExpanded && (
                <div className="min-w-0">
                  <h1 className="text-base font-extrabold tracking-tight text-white truncate">
                    OmniGen
                  </h1>
                </div>
              )}
            </Link>
          </div>

          {isExpanded && (
            <p className="text-[11px] text-slate-400 leading-relaxed pl-1">
              Hệ thống tách video slicer & trộn lách content mỹ phẩm
            </p>
          )}
        </div>

        {/* Navigation Modules */}
        <nav
          className={`flex-1 overflow-y-auto ${
            isExpanded ? "p-3 space-y-1.5" : "py-3 px-1.5 space-y-2"
          }`}
        >
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const Icon = item.icon;
              const isActive = mainTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  title={item.label}
                  className={`group relative w-full transition-all cursor-pointer ${
                    isExpanded
                      ? `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/80"
                        }`
                      : `flex flex-col items-center justify-center py-3 px-1 rounded-2xl gap-1.5 ${
                          isActive
                            ? "bg-indigo-600/20 text-white border border-indigo-500/40 shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                        }`
                  }`}
                >
                  {isExpanded ? (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive
                              ? "text-white"
                              : "text-slate-400 group-hover:text-indigo-400"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold transition-colors shrink-0 ${
                            isActive
                              ? "bg-white/25 text-white"
                              : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="relative flex items-center justify-center">
                        <Icon
                          className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                            isActive
                              ? "text-indigo-400"
                              : "text-slate-300 group-hover:text-white"
                          }`}
                        />
                        {item.badge !== undefined && (
                          <span
                            className={`absolute -top-2 -right-3 text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold leading-tight shadow ${
                              isActive
                                ? "bg-indigo-500 text-white"
                                : "bg-indigo-600/90 text-white border border-indigo-400/40"
                            }`}
                          >
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] leading-tight text-center font-medium transition-colors px-0.5 line-clamp-1 ${
                          isActive
                            ? "text-white font-bold"
                            : "text-slate-400 group-hover:text-white"
                        }`}
                      >
                        {item.shortLabel}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
        </nav>
      </aside>

      {/* Mobile Drawer Overlay & Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onCloseMobile}
          />

          {/* Drawer Content */}
          <aside className="relative w-72 max-w-[82vw] bg-slate-950 h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/"
                  onClick={onCloseMobile}
                  className="flex items-center gap-3 hover:opacity-90 transition min-w-0"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-base font-extrabold tracking-tight text-white truncate">
                    OmniGen
                  </h1>
                </Link>

                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  title="Đóng menu"
                  aria-label="Đóng menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Hệ thống tách video slicer & trộn lách content mỹ phẩm
              </p>
            </div>

            {/* Drawer Navigation Modules */}
            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
              {navItems
                .filter((item) => item.visible)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = mainTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                          : "text-slate-300 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            isActive
                              ? "bg-white/25 text-white"
                              : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
