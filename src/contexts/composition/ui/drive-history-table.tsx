"use client";

import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  ExternalLink,
  Eye,
  Film,
  Lock,
  Mic,
  Trash2,
  Unlock,
} from "lucide-react";

import type { ClipId, ShotCategory, VoiceId } from "@/contexts/shared-kernel";
import {
  Button,
  type ChipColor,
  IconButton,
  SelectField,
  StatusChip,
  StudioTable,
  StudioTableCell,
  type StudioTableColumnDef,
  StudioTableRow,
  Text,
} from "@/shared/ui";

import type { Clip, VoiceClip } from "../domain/types";

export interface ProcessedDriveEntry {
  readonly id: string;
  readonly category: ShotCategory | "voice";
  readonly categoryLabel: string;
  readonly chipColor: ChipColor;
  readonly name: string;
  readonly url: string | null;
  readonly duration: number;
  readonly clip?: Clip | undefined;
  readonly voice?: VoiceClip | undefined;
}

export interface DriveHistoryTableProps {
  readonly entries: ReadonlyArray<ProcessedDriveEntry>;
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly canEdit: boolean;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (size: number) => void;
  readonly onPreviewClip: (clip: Clip) => void;
  readonly onToggleLockFlip?: ((clipId: ClipId) => void) | undefined;
  readonly onRemoveClip: (clipId: ClipId) => Promise<void> | void;
  readonly onRemoveVoice: (voiceId: VoiceId) => Promise<void> | void;
  readonly onCopied?: ((url: string) => void) | undefined;
}

const HISTORY_TABLE_COLUMNS: ReadonlyArray<StudioTableColumnDef> = [
  { id: "category", label: "Nhóm", className: "w-28" },
  { id: "file", label: "Tên file & Link Drive", isRowHeader: true },
  { id: "duration", label: "Thời lượng", className: "w-24" },
  { id: "actions", label: "Thao tác", align: "right", className: "w-36" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
] as const;

export function DriveHistoryTable({
  entries,
  totalCount,
  page,
  pageSize,
  totalPages,
  canEdit,
  onPageChange,
  onPageSizeChange,
  onPreviewClip,
  onToggleLockFlip,
  onRemoveClip,
  onRemoveVoice,
  onCopied,
}: DriveHistoryTableProps) {
  if (entries.length === 0) {
    return (
      <Text variant="caption" className="block py-8 text-center text-zinc-500">
        Không có file hoặc link Google Drive nào khớp.
      </Text>
    );
  }

  const fromItem = (page - 1) * pageSize + 1;
  const toItem = Math.min(totalCount, (page - 1) * pageSize + entries.length);

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <Text variant="caption" className="text-zinc-400">
        Hiển thị{" "}
        <span className="font-semibold text-zinc-100">
          {fromItem}–{toItem}
        </span>{" "}
        trên tổng số <span className="font-semibold text-zinc-100">{totalCount}</span> mục
      </Text>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Text variant="caption" className="text-zinc-400">
            Dòng mỗi trang:
          </Text>
          <SelectField
            ariaLabel="Số dòng mỗi trang"
            value={String(pageSize)}
            onValueChange={(val) => {
              const parsed = Number(val);
              if (Number.isFinite(parsed) && parsed > 0) {
                onPageSizeChange(parsed);
              }
            }}
            options={PAGE_SIZE_OPTIONS}
            className="w-20"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page <= 1}
            aria-label="Trang trước"
            onPress={() => {
              onPageChange(Math.max(1, page - 1));
            }}
            className="h-8 min-w-8 border border-zinc-800 px-2 text-zinc-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Text variant="caption" className="min-w-12 text-center font-mono text-zinc-300">
            {page} / {totalPages}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            isDisabled={page >= totalPages}
            aria-label="Trang sau"
            onPress={() => {
              onPageChange(Math.min(totalPages, page + 1));
            }}
            className="h-8 min-w-8 border border-zinc-800 px-2 text-zinc-300"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <StudioTable
      ariaLabel="Bảng lịch sử link Google Drive"
      columns={HISTORY_TABLE_COLUMNS}
      contentClassName="min-w-[620px]"
      footer={footer}
    >
      {entries.map((item) => (
        <StudioTableRow key={`${item.category}_${item.id}`} id={`${item.category}_${item.id}`}>
          <StudioTableCell>
            <StatusChip color={item.chipColor} variant="soft" size="sm">
              {item.categoryLabel}
            </StatusChip>
          </StudioTableCell>

          <StudioTableCell>
            <div className="flex max-w-[320px] flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                {item.url ? (
                  <Cloud className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                ) : item.category === "voice" ? (
                  <Mic className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                ) : (
                  <Film className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                )}
                <Text variant="label" className="truncate text-white">
                  {item.name}
                </Text>
              </div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 truncate font-mono text-[10px] text-sky-400 hover:underline"
                >
                  <span className="truncate">{item.url}</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ) : null}
            </div>
          </StudioTableCell>

          <StudioTableCell>
            <Text variant="mono" className="text-[11px] text-zinc-400">
              {item.duration.toFixed(1)}s
            </Text>
          </StudioTableCell>

          <StudioTableCell align="right">
            <div className="flex items-center justify-end gap-1">
              {item.clip ? (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Xem trước clip ${item.name}`}
                  onPress={() => {
                    if (item.clip) onPreviewClip(item.clip);
                  }}
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-400" />
                </IconButton>
              ) : null}
              {canEdit && item.clip && onToggleLockFlip ? (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Khoá lật clip ${item.name}`}
                  onPress={() => {
                    if (item.clip) onToggleLockFlip(item.clip.id);
                  }}
                >
                  {item.clip.lockFlipH ? (
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-zinc-500" />
                  )}
                </IconButton>
              ) : null}
              {item.url ? (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Sao chép link ${item.name}`}
                  onPress={() => {
                    if (item.url) {
                      void navigator.clipboard.writeText(item.url);
                      onCopied?.(item.url);
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                </IconButton>
              ) : null}
              {canEdit ? (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Xoá ${item.name}`}
                  onPress={() => {
                    if (item.voice) {
                      void onRemoveVoice(item.voice.id);
                    } else if (item.clip) {
                      void onRemoveClip(item.clip.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400 hover:text-rose-300" />
                </IconButton>
              ) : null}
            </div>
          </StudioTableCell>
        </StudioTableRow>
      ))}
    </StudioTable>
  );
}
