"use client";

import { ChevronFirst, ChevronLast, Merge, Play, Scissors, Square } from "lucide-react";
import type { ReactNode, RefObject } from "react";

import { IconButton, KbdChip, StatusChip, StudioTooltip, Text } from "@/shared/ui";

import type { Shot } from "../domain/types";
import { CATEGORY_META_MAP } from "./category-meta";

export interface SplitVideoMonitorProps {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly sourceVideoUrl: string | null;
  readonly shots: ReadonlyArray<Shot>;
  readonly selectedShot: Shot | null;
  readonly currentTime: number;
  readonly totalDuration: number;
  readonly isPlaying: boolean;
  readonly isLoopingShot: boolean;
  readonly canEdit: boolean;
  readonly onTimeUpdate: (time: number) => void;
  readonly onPlayingChange: (playing: boolean) => void;
  readonly onLoadedMetadata: (duration: number) => void;
  readonly onToggleLoopShot: () => void;
  readonly onSeekTo: (time: number) => void;
  readonly onSplitAtCurrent: () => void;
  readonly onMergeNext: () => void;
  readonly onSelectShot: (shot: Shot) => void;
  readonly actionsFooter?: ReactNode | undefined;
}

export function SplitVideoMonitor({
  videoRef,
  sourceVideoUrl,
  shots,
  selectedShot,
  currentTime,
  totalDuration,
  isPlaying,
  isLoopingShot,
  canEdit,
  onTimeUpdate,
  onPlayingChange,
  onLoadedMetadata,
  onToggleLoopShot,
  onSeekTo,
  onSplitAtCurrent,
  onMergeNext,
  onSelectShot,
  actionsFooter,
}: SplitVideoMonitorProps) {
  const isFlipped = selectedShot?.edits.flip._tag === "Flipped";
  const selectedCategoryLabel = selectedShot
    ? selectedShot._tag === "ClassifiedShot"
      ? CATEGORY_META_MAP[selectedShot.category].folderName
      : "CHƯA GÁN"
    : null;

  const selectedIndex = selectedShot ? shots.findIndex((s) => s.id === selectedShot.id) : -1;
  const canMerge = selectedIndex >= 0 && selectedIndex < shots.length - 1;
  const safeTotal = Math.max(0.1, totalDuration);

  return (
    <div className="flex flex-col gap-3">
      {/* Preview 9:16 full viền (không bọc card) */}
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-zinc-800/80 bg-black">
        {sourceVideoUrl ? (
          <video
            ref={videoRef}
            src={sourceVideoUrl}
            controls
            playsInline
            onTimeUpdate={(e) => {
              const now = e.currentTarget.currentTime;
              if (isLoopingShot && selectedShot) {
                if (now >= selectedShot.range.end) {
                  e.currentTarget.pause();
                  onPlayingChange(false);
                }
              }
              onTimeUpdate(now);
            }}
            onPlay={() => {
              onPlayingChange(true);
            }}
            onPause={() => {
              onPlayingChange(false);
            }}
            onEnded={() => {
              onPlayingChange(false);
            }}
            onLoadedMetadata={(e) => {
              if (Number.isFinite(e.currentTarget.duration)) {
                onLoadedMetadata(e.currentTarget.duration);
              }
            }}
            className={`h-full w-full object-contain transition-transform ${
              isFlipped ? "-scale-x-100" : ""
            }`}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <Text variant="caption" className="text-zinc-500">
              Chọn video gốc ở bên trên để xem trước và tách cảnh
            </Text>
          </div>
        )}

        {selectedShot ? (
          <div className="pointer-events-none absolute top-2.5 right-2.5 left-2.5">
            <StatusChip
              color="default"
              variant="soft"
              size="sm"
              className="max-w-full truncate bg-black/75 text-white backdrop-blur"
            >
              Đang chọn: {selectedShot.label} ({selectedCategoryLabel})
            </StatusChip>
          </div>
        ) : null}
      </div>

      {/* Card nhỏ tinh tế gom các nút điều khiển + timeline phân đoạn */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-zinc-800/80 bg-[#0b0d18] p-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            <StudioTooltip
              content={isPlaying || isLoopingShot ? "Dừng phát" : "Xem riêng cảnh đang chọn"}
            >
              <IconButton
                size="sm"
                variant={isPlaying || isLoopingShot ? "danger" : "primary"}
                aria-label={isPlaying || isLoopingShot ? "Dừng lặp" : "Xem riêng"}
                isDisabled={!selectedShot || !sourceVideoUrl}
                onPress={onToggleLoopShot}
              >
                {isPlaying || isLoopingShot ? (
                  <Square className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </IconButton>
            </StudioTooltip>

            <StudioTooltip content="Nhảy về đầu cảnh">
              <IconButton
                size="sm"
                variant="secondary"
                aria-label="Đầu cảnh"
                isDisabled={!selectedShot || !sourceVideoUrl}
                onPress={() => {
                  if (selectedShot) onSeekTo(selectedShot.range.begin);
                }}
              >
                <ChevronFirst className="h-4 w-4" />
              </IconButton>
            </StudioTooltip>

            <StudioTooltip content="Nhảy tới cuối cảnh">
              <IconButton
                size="sm"
                variant="secondary"
                aria-label="Cuối cảnh"
                isDisabled={!selectedShot || !sourceVideoUrl}
                onPress={() => {
                  if (selectedShot) {
                    onSeekTo(Math.max(0, selectedShot.range.end - 0.1));
                  }
                }}
              >
                <ChevronLast className="h-4 w-4" />
              </IconButton>
            </StudioTooltip>
          </div>

          <Text variant="mono" className="text-[11px] text-indigo-300">
            {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
          </Text>

          <div className="flex items-center gap-1">
            <StudioTooltip content="Tách đôi tại mốc hiện tại (S)">
              <IconButton
                size="sm"
                variant="secondary"
                aria-label="Tách (S)"
                isDisabled={!canEdit || !selectedShot || !sourceVideoUrl}
                onPress={onSplitAtCurrent}
              >
                <Scissors className="h-3.5 w-3.5 text-rose-400" />
              </IconButton>
            </StudioTooltip>

            <StudioTooltip content="Gộp với cảnh liền sau">
              <IconButton
                size="sm"
                variant="secondary"
                aria-label="Gộp sau"
                isDisabled={!canEdit || !canMerge}
                onPress={onMergeNext}
              >
                <Merge className="h-3.5 w-3.5" />
              </IconButton>
            </StudioTooltip>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-zinc-800/70 pt-2">
          <div className="flex items-center justify-between">
            <Text variant="caption" className="text-[11px] text-zinc-400">
              Timeline phân đoạn
            </Text>
            <Text variant="mono" className="text-[11px] text-emerald-400">
              {shots.length} shots
            </Text>
          </div>

          <div className="flex h-7 w-full items-stretch gap-1 overflow-hidden rounded-lg bg-[#070811] p-1">
            {shots.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <Text variant="muted" className="text-[11px]">
                  Chưa có đoạn cảnh nào
                </Text>
              </div>
            ) : (
              shots.map((shot) => {
                const dur = Math.max(0.2, shot.range.end - shot.range.begin);
                const widthPct = Math.max(4, (dur / safeTotal) * 100);
                const isSelected = selectedShot?.id === shot.id;
                const meta =
                  shot._tag === "ClassifiedShot" ? CATEGORY_META_MAP[shot.category] : null;

                return (
                  <div
                    key={shot.id}
                    role="button"
                    tabIndex={0}
                    title={`${shot.label} (${shot.range.begin.toFixed(1)}s - ${shot.range.end.toFixed(1)}s)`}
                    style={{ width: `${widthPct.toFixed(2)}%` }}
                    onClick={() => {
                      onSelectShot(shot);
                      onSeekTo(shot.range.begin);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectShot(shot);
                        onSeekTo(shot.range.begin);
                      }
                    }}
                    className={`flex cursor-pointer items-center justify-center truncate rounded border px-1 text-[10px] font-bold transition ${
                      meta ? meta.timelineClass : "border-zinc-700 bg-zinc-800/70 text-zinc-300"
                    } ${isSelected ? "ring-2 ring-white" : "opacity-80 hover:opacity-100"}`}
                  >
                    {meta ? meta.shortCode : "DRF"}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {actionsFooter}

      {/* Hướng dẫn phím tắt nhỏ gọn tinh tế bên dưới Preview */}
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-1 text-[10px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <KbdChip>1-5</KbdChip>
          <span>Gán nhóm</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <KbdChip>S</KbdChip>
          <span>Tách</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <KbdChip>M</KbdChip>
          <span>Mirror</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <KbdChip>L</KbdChip>
          <span>Khóa chữ</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <KbdChip>Space</KbdChip>
          <span>Phát/Dừng</span>
        </span>
      </div>
    </div>
  );
}
