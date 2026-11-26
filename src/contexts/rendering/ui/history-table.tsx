"use client";

import { ChevronLeft, ChevronRight, Clock, Download, History, Mic, Trash2 } from "lucide-react";

import type { VoiceClip } from "@/contexts/composition";
import {
  Button,
  EmptyState,
  IconButton,
  SelectField,
  StudioTable,
  StudioTableCell,
  type StudioTableColumnDef,
  StudioTableRow,
  SwitchControl,
  Text,
} from "@/shared/ui";

import type { RenderedRecord } from "../domain/types";
import {
  extractRenderedPayload,
  formatRenderedDateTime,
  HISTORY_CATEGORY_META,
  ORDERED_CATEGORIES,
} from "./history-payload";

export interface HistoryTableProps {
  readonly records: ReadonlyArray<RenderedRecord>;
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly voices: ReadonlyArray<VoiceClip>;
  readonly selectedRecordId: string | null;
  readonly canEdit: boolean;
  readonly canExport: boolean;
  readonly pendingId: string | null;
  readonly downloadingId: string | null;
  readonly onSelectRecord: (record: RenderedRecord) => void;
  readonly onToggleUsed: (record: RenderedRecord) => void;
  readonly onDownloadMp4: (record: RenderedRecord) => void;
  readonly onRequestDelete: (record: RenderedRecord) => void;
  readonly onPageChange: (nextPage: number) => void;
  readonly onPageSizeChange: (nextSize: number) => void;
}

const TABLE_COLUMNS: ReadonlyArray<StudioTableColumnDef> = [
  { id: "stt", label: "STT", className: "w-14" },
  { id: "name", label: "Tên video", isRowHeader: true, className: "min-w-[200px]" },
  { id: "duration", label: "Thời lượng", className: "w-28" },
  { id: "scenes", label: "5 cảnh tổ hợp", className: "min-w-[380px]" },
  { id: "voice", label: "Voice", className: "w-28" },
  { id: "status", label: "Trạng thái", className: "w-36" },
  { id: "actions", label: "Thao tác", align: "right", className: "w-24" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
] as const;

export function HistoryTable({
  records,
  totalCount,
  page,
  pageSize,
  totalPages,
  voices,
  selectedRecordId,
  canEdit,
  canExport,
  pendingId,
  downloadingId,
  onSelectRecord,
  onToggleUsed,
  onDownloadMp4,
  onRequestDelete,
  onPageChange,
  onPageSizeChange,
}: HistoryTableProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={<History className="h-6 w-6" />}
        title="Chưa có video nào khớp bộ lọc"
        description="Khi render hoặc đánh dấu đã render video từ tab Trộn video, lịch sử sẽ hiển thị tại đây."
      />
    );
  }

  const startIndex = (page - 1) * pageSize;
  const fromItem = startIndex + 1;
  const toItem = Math.min(totalCount, startIndex + records.length);

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <Text variant="caption" className="text-zinc-400">
        Hiển thị{" "}
        <span className="font-semibold text-zinc-100">
          {fromItem}–{toItem}
        </span>{" "}
        trên tổng số <span className="font-semibold text-zinc-100">{totalCount}</span> video
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
    <StudioTable ariaLabel="Bảng lịch sử video đã render" columns={TABLE_COLUMNS} footer={footer}>
      {records.map((record, idx) => {
        const view = extractRenderedPayload(record, voices);
        const isUsed = record.status === "used";
        const isBusy = pendingId === record.id;
        const isDownloading = downloadingId === record.id;
        const stt = startIndex + idx + 1;

        return (
          <StudioTableRow
            key={record.id}
            id={record.id}
            isSelected={selectedRecordId === record.id}
            onAction={() => {
              onSelectRecord(record);
            }}
          >
            <StudioTableCell>
              <span className="font-mono text-xs text-zinc-500">#{stt}</span>
            </StudioTableCell>

            <StudioTableCell>
              <div className="flex max-w-[240px] flex-col gap-0.5">
                <span className="truncate text-xs font-semibold text-zinc-100" title={record.name}>
                  {record.name}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <Clock className="h-3 w-3 shrink-0" />
                  {formatRenderedDateTime(record.renderedAt)}
                </span>
              </div>
            </StudioTableCell>

            <StudioTableCell>
              {view.finalDuration !== null ? (
                <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                  {view.finalDuration.toFixed(1)}s
                </span>
              ) : (
                <span className="text-xs text-zinc-600">-</span>
              )}
            </StudioTableCell>

            <StudioTableCell>
              <div className="flex flex-wrap items-center gap-1.5">
                {ORDERED_CATEGORIES.map((cat) => {
                  const meta = HISTORY_CATEGORY_META[cat];
                  const slot = view.slots.find((s) => s.category === cat);
                  const displayLabel = slot?.label ?? "";
                  return (
                    <span
                      key={cat}
                      title={displayLabel ? `${meta.title}: ${displayLabel}` : meta.title}
                      className={`inline-flex max-w-[104px] items-center gap-1 rounded-md border bg-transparent px-2 py-0.5 font-mono text-[11px] ${meta.borderClass} ${meta.textClass}`}
                    >
                      <span className="shrink-0 font-semibold">{meta.prefix}</span>
                      {displayLabel ? (
                        <span className="truncate text-zinc-200">{displayLabel}</span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </StudioTableCell>

            <StudioTableCell>
              {view.voiceName ? (
                <span className="inline-flex max-w-[110px] items-center gap-1 rounded-full border border-indigo-500/35 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo-200">
                  <Mic className="h-3 w-3 shrink-0 text-indigo-300" />
                  <span className="truncate">{view.voiceName}</span>
                </span>
              ) : (
                <span className="text-xs text-zinc-600">-</span>
              )}
            </StudioTableCell>

            <StudioTableCell>
              <div
                className="inline-flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
              >
                <SwitchControl
                  isSelected={isUsed}
                  isDisabled={!canEdit || isBusy}
                  color="success"
                  size="sm"
                  ariaLabel={`Trạng thái sử dụng của ${record.name}`}
                  label={isUsed ? "Đã dùng" : "Chưa dùng"}
                  labelClassName={
                    isUsed
                      ? "text-xs font-medium text-emerald-400"
                      : "text-xs font-medium text-zinc-400"
                  }
                  onChange={() => {
                    onToggleUsed(record);
                  }}
                />
              </div>
            </StudioTableCell>

            <StudioTableCell align="right">
              <div
                className="flex items-center justify-end gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {canExport && view.slots.length > 0 ? (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Tải lại MP4 cho ${record.name}`}
                    isLoading={isDownloading}
                    isDisabled={isDownloading}
                    onPress={() => {
                      onDownloadMp4(record);
                    }}
                    className="h-8 w-8 border-0 !bg-transparent text-emerald-400 hover:!bg-emerald-500/15 hover:text-emerald-300"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </IconButton>
                ) : null}

                {canEdit ? (
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Xóa ${record.name}`}
                    isDisabled={isBusy}
                    onPress={() => {
                      onRequestDelete(record);
                    }}
                    className="h-8 w-8 border-0 !bg-transparent text-rose-400 hover:!bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                ) : null}
              </div>
            </StudioTableCell>
          </StudioTableRow>
        );
      })}
    </StudioTable>
  );
}
