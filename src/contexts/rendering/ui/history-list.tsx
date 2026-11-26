"use client";

import { CheckCircle2, Download, Eye, Film, Trash2 } from "lucide-react";

import { Button, EmptyState, IconButton, Text } from "@/shared/ui";

import type { RenderedRecord, RenderedRecordId } from "../domain/types";

export interface HistoryListProps {
  readonly records: ReadonlyArray<RenderedRecord>;
  readonly canEdit: boolean;
  readonly onPreview?: ((record: RenderedRecord) => void) | undefined;
  readonly onToggleUsed: (id: RenderedRecordId, used: boolean) => void;
  readonly onDelete: (id: RenderedRecordId) => void;
}

export function HistoryList({
  records,
  canEdit,
  onPreview,
  onToggleUsed,
  onDelete,
}: HistoryListProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={<Film className="h-8 w-8" />}
        title="Chưa có video nào được render"
        description="Các video xuất xong từ tab phối trộn sẽ xuất hiện tại đây."
      />
    );
  }

  return (
    <ul className="space-y-2" aria-label="Danh sách video đã render">
      {records.map((rec) => {
        const isUsed = rec.status === "used";
        const outputUrl = rec.outputUrl._tag === "Some" ? rec.outputUrl.value : null;

        return (
          <li
            key={rec.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <Text variant="label" className="block truncate text-white">
                {rec.name}
              </Text>
              <Text variant="caption" as="div" className="text-[11px] text-zinc-400">
                {rec.renderedAt} · {isUsed ? "Đã sử dụng" : "Chưa sử dụng"}
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {outputUrl && onPreview ? (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Xem lại ${rec.name}`}
                  onPress={() => {
                    onPreview(rec);
                  }}
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-400" />
                </IconButton>
              ) : null}
              {outputUrl ? (
                <a
                  href={outputUrl}
                  download
                  aria-label={`Tải MP4 ${rec.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400 transition hover:bg-white/10"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <Button
                size="sm"
                variant={isUsed ? "primary" : "ghost"}
                isDisabled={!canEdit}
                onPress={() => {
                  onToggleUsed(rec.id, !isUsed);
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isUsed ? "Đã dùng" : "Đánh dấu đã dùng"}
              </Button>
              {canEdit ? (
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label={`Xoá bản ghi ${rec.name}`}
                  onPress={() => {
                    onDelete(rec.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                </IconButton>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
