"use client";

import { Check, Clock, Copy, Download, ExternalLink, HardDrive, Layers, Mic } from "lucide-react";
import { useMemo, useState } from "react";

import { PreviewPlayer916, type VoiceClip } from "@/contexts/composition";
import { Button, IconButton, StudioDrawer, SwitchControl, Text } from "@/shared/ui";

import type { RenderedRecord } from "../domain/types";
import {
  extractRenderedPayload,
  formatRenderedDateTime,
  HISTORY_CATEGORY_META,
  toPlannedVideoFromRecord,
} from "./history-payload";

export interface HistoryDetailDrawerProps {
  readonly record: RenderedRecord | null;
  readonly voices: ReadonlyArray<VoiceClip>;
  readonly canEdit: boolean;
  readonly canExport: boolean;
  readonly isDownloading: boolean;
  readonly onClose: () => void;
  readonly onToggleUsed: (record: RenderedRecord) => void;
  readonly onDownloadMp4: (record: RenderedRecord) => void;
}

export function HistoryDetailDrawer({
  record,
  voices,
  canEdit,
  canExport,
  isDownloading,
  onClose,
  onToggleUsed,
  onDownloadMp4,
}: HistoryDetailDrawerProps) {
  const [copiedKey, setCopiedKey] = useState(false);

  const view = useMemo(
    () => (record ? extractRenderedPayload(record, voices) : null),
    [record, voices],
  );

  const plannedVideo = useMemo(
    () => (record && view ? toPlannedVideoFromRecord(record, view) : null),
    [record, view],
  );

  const matchedVoice = useMemo(
    () => (view?.voiceId ? voices.find((v) => v.id === view.voiceId) : undefined),
    [view, voices],
  );

  if (!record || !view) return null;

  const isUsed = record.status === "used";

  const handleCopyTupleKey = () => {
    void navigator.clipboard.writeText(record.tupleKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => {
        setCopiedKey(false);
      }, 1500);
    });
  };

  const footer = (
    <div className="flex w-full flex-wrap items-center justify-end gap-2">
      {canExport && view.slots.length > 0 ? (
        <Button
          size="sm"
          variant="primary"
          isLoading={isDownloading}
          isDisabled={isDownloading}
          onPress={() => {
            onDownloadMp4(record);
          }}
          className="!bg-emerald-600 !text-white hover:!bg-emerald-500"
        >
          <Download className="h-3.5 w-3.5" />
          Tải lại MP4
        </Button>
      ) : null}

      <Button size="sm" variant="ghost" onPress={onClose}>
        Đóng
      </Button>
    </div>
  );

  return (
    <StudioDrawer
      isOpen={Boolean(record)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      placement="right"
      title={record.name}
      subtitle={`Render lúc ${formatRenderedDateTime(record.renderedAt)}`}
      dialogClassName="w-full max-w-4xl"
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-[#070811] px-3.5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              Tổng thời lượng:
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-300">
              {view.finalDuration !== null ? `${view.finalDuration.toFixed(1)}s` : "-"}
            </span>
          </div>

          <SwitchControl
            isSelected={isUsed}
            isDisabled={!canEdit}
            color="success"
            size="sm"
            labelPosition="left"
            ariaLabel="Đổi trạng thái sử dụng"
            label={isUsed ? "Đã sử dụng" : "Chưa sử dụng"}
            labelClassName={
              isUsed ? "text-xs font-medium text-emerald-400" : "text-xs font-medium text-zinc-400"
            }
            onChange={() => {
              onToggleUsed(record);
            }}
          />
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* Cột trái: Chi tiết 5 cảnh (chỉ border màu category, không màu nền) */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" />
                <Text variant="label" className="text-zinc-200">
                  Chi tiết 5 cảnh trong tổ hợp
                </Text>
              </div>

              {view.slots.length > 0 ? (
                <div className="space-y-2">
                  {view.slots.map((slot, index) => {
                    const meta = HISTORY_CATEGORY_META[slot.category];
                    return (
                      <div
                        key={`${slot.category}_${String(index)}`}
                        className={`rounded-xl border bg-transparent px-3.5 py-2.5 ${meta.borderClass}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`shrink-0 rounded-md border bg-transparent px-1.5 py-0.5 font-mono text-[10px] font-semibold ${meta.borderClass} ${meta.textClass}`}
                            >
                              {meta.title}
                            </span>
                            <span className="truncate text-xs font-semibold text-zinc-100">
                              {slot.label || "Chưa đặt tên"}
                            </span>
                          </div>

                          <span className="shrink-0 font-mono text-xs font-semibold text-emerald-300">
                            {slot.effectiveDuration.toFixed(1)}s
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                          <div className="flex flex-wrap items-center gap-2 font-mono">
                            <span>
                              Cắt: {slot.videoBegin.toFixed(1)}s → {slot.videoEnd.toFixed(1)}s
                            </span>
                            <span>•</span>
                            <span>{slot.speed}x</span>
                            {slot.flipH ? (
                              <>
                                <span>•</span>
                                <span className="text-amber-300">Lật gương</span>
                              </>
                            ) : null}
                          </div>

                          {slot.driveUrl ? (
                            <a
                              href={slot.driveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sky-400 transition hover:text-sky-300"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Link Google Drive
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-zinc-500">
                              <HardDrive className="h-3 w-3" />
                              File máy tính
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Text variant="caption" className="text-zinc-500">
                  Bản ghi này không lưu chi tiết 5 cảnh.
                </Text>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-[#070811] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                  <Mic className="h-3.5 w-3.5 text-indigo-400" />
                  Giọng lồng tiếng (Voiceover)
                </span>
                {view.voiceName ? (
                  <span className="text-xs font-semibold text-indigo-200">
                    {view.voiceName}
                    {matchedVoice ? ` (${matchedVoice.duration.toFixed(1)}s)` : ""}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">Không lồng tiếng</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-[#070811] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Text variant="caption" className="text-zinc-500">
                    Mã tổ hợp
                  </Text>
                  <Text
                    variant="caption"
                    className="mt-0.5 block truncate font-mono text-[11px] text-zinc-300"
                  >
                    {record.tupleKey}
                  </Text>
                </div>
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Sao chép mã tổ hợp"
                  onPress={handleCopyTupleKey}
                  className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
                >
                  {copiedKey ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </IconButton>
              </div>
            </div>
          </div>

          {/* Cột phải: Preview 9:16 full viền không bọc card container */}
          <div className="w-full shrink-0 lg:w-[320px]">
            {plannedVideo ? (
              <PreviewPlayer916
                video={plannedVideo}
                voiceUrl={matchedVoice?.localUrl ?? null}
                voiceDuration={matchedVoice?.duration}
                enableVoice={Boolean(matchedVoice)}
              />
            ) : (
              <div className="flex aspect-[9/16] w-full items-center justify-center rounded-2xl border border-dashed border-zinc-800 text-xs text-zinc-500">
                Không có dữ liệu xem trước
              </div>
            )}
          </div>
        </div>
      </div>
    </StudioDrawer>
  );
}
