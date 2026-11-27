"use client";

import {
  CheckCircle2,
  Film,
  Folder,
  Layers,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";

import { ActionMenuDropdown, type ActionMenuItem, Text } from "@/shared/ui";

export interface DashboardProjectItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly foldersCount?: number | undefined;
  readonly poolCount?: number | undefined;
  readonly renderedCount?: number | undefined;
  readonly permissionBadges?: ReadonlyArray<string> | undefined;
  readonly isOwner?: boolean | undefined;
  readonly canEdit?: boolean | undefined;
  readonly ownerName?: string | undefined;
  readonly ownerEmail?: string | undefined;
  readonly updatedAt?: string | undefined;
}

export interface ProjectCardProps {
  readonly project: DashboardProjectItem;
  readonly onShare: (project: DashboardProjectItem) => void;
  readonly onEdit: (project: DashboardProjectItem) => void;
  readonly onDelete: (project: DashboardProjectItem) => void;
}

const formatDateDdMmYyyy = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

export function ProjectCard({ project, onShare, onEdit, onDelete }: ProjectCardProps) {
  const router = useRouter();
  const isOwner = project.isOwner !== false;
  const canEdit = isOwner || Boolean(project.canEdit);
  const updatedStr = formatDateDdMmYyyy(project.updatedAt);
  const ownerLabel = project.ownerName || project.ownerEmail || "";
  const detailHref = `/projects/${project.id}`;

  const menuItems: Array<ActionMenuItem> = [];
  if (isOwner) {
    menuItems.push({
      id: "share",
      label: "Chia sẻ dự án",
      icon: <Share2 className="h-3.5 w-3.5 text-indigo-400" />,
      onAction: () => {
        onShare(project);
      },
    });
  }
  if (canEdit) {
    menuItems.push({
      id: "edit",
      label: "Chỉnh sửa dự án",
      icon: <Pencil className="h-3.5 w-3.5 text-zinc-300" />,
      onAction: () => {
        onEdit(project);
      },
    });
  }
  if (isOwner) {
    menuItems.push({
      id: "delete",
      label: "Xóa dự án",
      icon: <Trash2 className="h-3.5 w-3.5 text-rose-400" />,
      isDanger: true,
      onAction: () => {
        onDelete(project);
      },
    });
  }

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-card-action]")) return;
    router.push(detailHref);
  };

  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-card-action]")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(detailHref);
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Mở dự án ${project.name}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0c16] p-5 transition-colors hover:border-indigo-500/50 hover:bg-[#0d1020] focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:outline-none"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/15 text-indigo-300">
              <Layers className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Text
                  variant="body"
                  className="truncate text-sm font-bold text-white transition group-hover:text-indigo-300"
                >
                  {project.name}
                </Text>
                {isOwner ? (
                  <span className="rounded-full border border-indigo-500/35 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                    Của tôi
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Được chia sẻ
                  </span>
                )}
              </div>

              <Text variant="muted" className="mt-0.5 block truncate text-[11px] text-zinc-500">
                {updatedStr ? `Cập nhật ${updatedStr}` : ""}
                {!isOwner && ownerLabel ? `${updatedStr ? " · " : ""}Bởi ${ownerLabel}` : ""}
              </Text>
            </div>
          </div>

          {menuItems.length > 0 ? (
            <div
              data-card-action
              onClick={(e) => {
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
            >
              <ActionMenuDropdown
                ariaLabel={`Thao tác cho dự án ${project.name}`}
                items={menuItems}
                triggerClassName="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-200"
                trigger={<MoreVertical className="h-4 w-4" />}
              />
            </div>
          ) : null}
        </div>

        {project.permissionBadges && project.permissionBadges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {project.permissionBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        {project.description ? (
          <Text variant="caption" as="div" className="line-clamp-2 text-xs text-zinc-400">
            {project.description}
          </Text>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 pt-2 text-xs">
        <span className="inline-flex items-center gap-1 text-zinc-400">
          <Folder className="h-3.5 w-3.5 text-indigo-400" />
          {project.foldersCount ?? 0} folder
        </span>
        <span className="inline-flex items-center gap-1 text-sky-400">
          <Film className="h-3.5 w-3.5" />
          {project.poolCount ?? 0} clip
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {project.renderedCount ?? 0} đã render
        </span>
      </div>
    </div>
  );
}
