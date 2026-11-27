"use client";

import { CheckCircle2, Film, Folder, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";

import { ActionMenuDropdown, type ActionMenuItem, Text } from "@/shared/ui";

export interface FolderListItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly poolCount?: number | undefined;
  readonly renderedCount?: number | undefined;
  readonly updatedAt?: string | undefined;
}

export interface FolderCardProps {
  readonly projectId: string;
  readonly folder: FolderListItem;
  readonly canManageFolders: boolean;
  readonly onEdit: (folder: FolderListItem) => void;
  readonly onDelete: (folder: FolderListItem) => void;
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

export function FolderCard({
  projectId,
  folder,
  canManageFolders,
  onEdit,
  onDelete,
}: FolderCardProps) {
  const router = useRouter();
  const updatedStr = formatDateDdMmYyyy(folder.updatedAt);
  const detailHref = `/projects/${projectId}/folders/${folder.id}`;

  const menuItems: Array<ActionMenuItem> = canManageFolders
    ? [
        {
          id: "edit",
          label: "Đổi tên folder",
          icon: <Pencil className="h-3.5 w-3.5 text-zinc-300" />,
          onAction: () => {
            onEdit(folder);
          },
        },
        {
          id: "delete",
          label: "Xóa folder",
          icon: <Trash2 className="h-3.5 w-3.5 text-rose-400" />,
          isDanger: true,
          onAction: () => {
            onDelete(folder);
          },
        },
      ]
    : [];

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
      aria-label={`Mở folder ${folder.name}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0c16] p-5 transition-colors hover:border-indigo-500/50 hover:bg-[#0d1020] focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:outline-none"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/15 text-indigo-300">
              <Folder className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <Text
                variant="body"
                className="block truncate text-sm font-bold text-white transition group-hover:text-indigo-300"
              >
                {folder.name}
              </Text>
              {updatedStr ? (
                <Text variant="muted" className="mt-0.5 block text-[11px] text-zinc-500">
                  Cập nhật {updatedStr}
                </Text>
              ) : null}
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
                ariaLabel={`Thao tác cho folder ${folder.name}`}
                items={menuItems}
                triggerClassName="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-200"
                trigger={<MoreVertical className="h-4 w-4" />}
              />
            </div>
          ) : null}
        </div>

        {folder.description ? (
          <Text variant="caption" as="div" className="line-clamp-2 text-xs text-zinc-400">
            {folder.description}
          </Text>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 pt-2 text-xs">
        <span className="inline-flex items-center gap-1 text-sky-400">
          <Film className="h-3.5 w-3.5" />
          {folder.poolCount ?? 0} clip
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {folder.renderedCount ?? 0} đã render
        </span>
      </div>
    </div>
  );
}
