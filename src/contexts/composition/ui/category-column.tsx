"use client";

import {
  Cloud,
  Copy,
  ExternalLink,
  Eye,
  Film,
  FolderOpen,
  Link2,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useRef } from "react";

import type { ClipId, ShotCategory } from "@/contexts/shared-kernel";
import {
  Button,
  type ChipColor,
  EmptyState,
  IconButton,
  StatusChip,
  SurfaceBox,
  Text,
} from "@/shared/ui";

import type { Clip } from "../domain/types";

export interface CategoryColumnProps {
  readonly category: ShotCategory;
  readonly label: string;
  readonly chipColor?: ChipColor | undefined;
  readonly clips: ReadonlyArray<Clip>;
  readonly canEdit: boolean;
  readonly onOpenAddLinks: (category: ShotCategory) => void;
  readonly onUploadFiles?: ((category: ShotCategory, files: FileList) => Promise<void>) | undefined;
  readonly onPreviewClip: (clip: Clip) => void;
  readonly onToggleLockFlip?: ((clipId: ClipId) => void) | undefined;
  readonly onRemoveClip: (clipId: ClipId) => Promise<void>;
  readonly onClearCategory: (category: ShotCategory) => Promise<void>;
  readonly onCopyLink?: ((url: string) => void) | undefined;
}

const DEFAULT_CHIP_COLORS: Record<ShotCategory, ChipColor> = {
  open: "danger",
  product: "accent",
  texture: "warning",
  apply: "success",
  end: "accent",
};

export function CategoryColumn({
  category,
  label,
  chipColor,
  clips,
  canEdit,
  onOpenAddLinks,
  onUploadFiles,
  onPreviewClip,
  onToggleLockFlip,
  onRemoveClip,
  onClearCategory,
  onCopyLink,
}: CategoryColumnProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedColor = chipColor ?? DEFAULT_CHIP_COLORS[category];

  return (
    <SurfaceBox className="flex min-h-[240px] flex-col justify-between gap-2.5 border-zinc-800 bg-[#070811] p-3.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && onUploadFiles) {
            void onUploadFiles(category, e.target.files);
          }
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <StatusChip color={resolvedColor} variant="soft" size="sm">
            {label}
          </StatusChip>
          <StatusChip color="default" variant="soft" size="sm">
            {clips.length} clip
          </StatusChip>
        </div>

        <div className="flex items-center gap-1">
          {canEdit ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Thêm link Drive ${label}`}
                onPress={() => {
                  onOpenAddLinks(category);
                }}
                className="h-6 rounded-md px-2 text-[10px]"
              >
                <Link2 className="h-3 w-3 text-sky-400" />
                Link Drive
              </Button>
              {onUploadFiles ? (
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Tải file ${label}`}
                  onPress={() => {
                    fileInputRef.current?.click();
                  }}
                  className="h-6 rounded-md px-2 text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  File
                </Button>
              ) : null}
            </>
          ) : null}
          {canEdit && clips.length > 0 ? (
            <IconButton
              size="sm"
              variant="ghost"
              aria-label={`Xoá toàn bộ nhóm ${label}`}
              onPress={() => {
                void onClearCategory(category);
              }}
              className="h-6 w-6"
            >
              <Trash2 className="h-3 w-3 text-zinc-400 hover:text-rose-400" />
            </IconButton>
          ) : null}
        </div>
      </div>

      {clips.length === 0 ? (
        <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="Chưa có clip" />
      ) : (
        <ul className="max-h-60 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {clips.map((clip) => {
            const isDrive = clip.source._tag === "DriveClip";
            const driveUrl =
              clip.source._tag === "DriveClip"
                ? `https://drive.google.com/file/d/${clip.source.fileId}/view`
                : null;

            return (
              <li
                key={clip.id}
                className="space-y-1 rounded-lg border border-zinc-800/90 bg-[#0b0d18] p-2 text-xs"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    {isDrive ? (
                      <Cloud className="h-3 w-3 shrink-0 text-sky-400" />
                    ) : (
                      <Film className="h-3 w-3 shrink-0 text-zinc-400" />
                    )}
                    {clip.lockFlipH ? (
                      <Lock className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                    ) : null}
                    <Text
                      variant="label"
                      className="truncate text-[11px] font-medium text-zinc-200"
                    >
                      {clip.name}
                    </Text>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <Text variant="mono" className="mr-1 text-[10px] text-zinc-400">
                      {clip.duration.toFixed(1)}s
                    </Text>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Xem trước clip ${clip.name}`}
                      onPress={() => {
                        onPreviewClip(clip);
                      }}
                      className="h-6 w-6"
                    >
                      <Eye className="h-3 w-3 text-indigo-400" />
                    </IconButton>
                    {canEdit && onToggleLockFlip ? (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        aria-label={`Khoá lật clip ${clip.name}`}
                        onPress={() => {
                          onToggleLockFlip(clip.id);
                        }}
                        className="h-6 w-6"
                      >
                        {clip.lockFlipH ? (
                          <Lock className="h-3 w-3 text-amber-400" />
                        ) : (
                          <Unlock className="h-3 w-3 text-zinc-500" />
                        )}
                      </IconButton>
                    ) : null}
                    {canEdit ? (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        aria-label={`Xoá clip ${clip.name}`}
                        onPress={() => {
                          void onRemoveClip(clip.id);
                        }}
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3 text-zinc-500 hover:text-rose-400" />
                      </IconButton>
                    ) : null}
                  </div>
                </div>

                {driveUrl ? (
                  <div className="flex items-center justify-between gap-1.5 rounded border border-zinc-800/70 bg-[#070811] px-1.5 py-0.5 font-mono text-[9px]">
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[180px] items-center gap-1 truncate text-sky-400 hover:underline"
                    >
                      <span className="truncate">{driveUrl}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    </a>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Sao chép link ${clip.name}`}
                      onPress={() => {
                        void navigator.clipboard.writeText(driveUrl);
                        onCopyLink?.(driveUrl);
                      }}
                      className="h-5 w-5"
                    >
                      <Copy className="h-2.5 w-2.5 text-zinc-400" />
                    </IconButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SurfaceBox>
  );
}
