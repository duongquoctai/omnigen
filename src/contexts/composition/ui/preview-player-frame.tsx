"use client";

import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { type RefObject, useCallback, useRef, useState } from "react";

import type { ShotCategory } from "@/contexts/shared-kernel";
import { IconButton, Text } from "@/shared/ui";

import type { PlannedSlot } from "../domain/types";

const CATEGORY_BADGE_CLASS: Readonly<Record<ShotCategory, string>> = {
  open: "bg-rose-500/30 text-rose-200 border-rose-500/50",
  product: "bg-sky-500/30 text-sky-200 border-sky-500/50",
  texture: "bg-amber-500/30 text-amber-200 border-amber-500/50",
  apply: "bg-emerald-500/30 text-emerald-200 border-emerald-500/50",
  end: "bg-purple-500/30 text-purple-200 border-purple-500/50",
};

export interface PreviewPlayerFrameProps {
  readonly videoRefA: RefObject<HTMLVideoElement | null>;
  readonly videoRefB: RefObject<HTMLVideoElement | null>;
  readonly audioRef: RefObject<HTMLAudioElement | null>;
  readonly slots: ReadonlyArray<PlannedSlot>;
  readonly currentSlot: PlannedSlot;
  readonly isoSlot: PlannedSlot | null;
  readonly isSlotMode: boolean;
  readonly isVideoAActive: boolean;
  readonly isPlaying: boolean;
  readonly isBuffering: boolean;
  readonly isDraggingBar: boolean;
  readonly activeSlotIndex: number;
  readonly timelineSec: number;
  readonly slotCurrentSec: number;
  readonly totalDuration: number;
  readonly enableVoice: boolean;
  readonly hasVoiceTrack: boolean;
  readonly mutedVoice: boolean;
  readonly onTogglePlay: () => void;
  readonly onRestart: () => void;
  readonly onToggleMuteVoice: () => void;
  readonly onDraggingBarChange: (dragging: boolean) => void;
  readonly onBarSeek: (sec: number) => void;
}

export function PreviewPlayerFrame({
  videoRefA,
  videoRefB,
  audioRef,
  slots,
  currentSlot,
  isoSlot,
  isSlotMode,
  isVideoAActive,
  isPlaying,
  isBuffering,
  isDraggingBar,
  activeSlotIndex,
  timelineSec,
  slotCurrentSec,
  totalDuration,
  enableVoice,
  hasVoiceTrack,
  mutedVoice,
  onTogglePlay,
  onRestart,
  onToggleMuteVoice,
  onDraggingBarChange,
  onBarSeek,
}: PreviewPlayerFrameProps) {
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [hoverSec, setHoverSec] = useState<number | null>(null);

  const computeSecFromPointer = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
      if (isSlotMode && isoSlot) {
        return isoSlot.videoBegin + ratio * Math.max(0.1, isoSlot.videoEnd - isoSlot.videoBegin);
      }
      return ratio * totalDuration;
    },
    [isSlotMode, isoSlot, totalDuration],
  );

  const flipScaleX = currentSlot.flipH ? -1 : 1;

  const progressPct =
    isSlotMode && isoSlot
      ? Math.max(
          0,
          Math.min(
            100,
            ((slotCurrentSec - isoSlot.videoBegin) /
              Math.max(0.1, isoSlot.videoEnd - isoSlot.videoBegin)) *
              100,
          ),
        )
      : Math.max(0, Math.min(100, (timelineSec / totalDuration) * 100));

  const hoverSlotLabel = (() => {
    if (hoverSec === null) return null;
    if (isSlotMode && isoSlot) {
      const rel = Math.max(0, (hoverSec - isoSlot.videoBegin) / (isoSlot.speed || 1));
      return `${rel.toFixed(1)}s • ${isoSlot.category.toUpperCase()}`;
    }
    const found =
      slots.find((s) => hoverSec >= s.enterBegin && hoverSec <= s.exitEnd + 0.05) ?? slots.at(0);
    return `${hoverSec.toFixed(1)}s${found ? ` • ${found.category.toUpperCase()}` : ""}`;
  })();

  const hoverPct =
    hoverSec === null
      ? 0
      : isSlotMode && isoSlot
        ? Math.max(
            8,
            Math.min(
              92,
              ((hoverSec - isoSlot.videoBegin) /
                Math.max(0.1, isoSlot.videoEnd - isoSlot.videoBegin)) *
                100,
            ),
          )
        : Math.max(8, Math.min(92, (hoverSec / totalDuration) * 100));

  const hasAnyMedia = slots.some((s) => Boolean(s.localUrl));

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative flex aspect-[9/16] w-full max-w-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Top Overlay: Active Category / Mode & Transform Badges */}
        <div className="relative z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent p-3">
          {isSlotMode && isoSlot ? (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-sm ${
                  CATEGORY_BADGE_CLASS[isoSlot.category]
                }`}
              >
                Cảnh {isoSlot.category.toUpperCase()} (Xem riêng)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  isPlaying ? "animate-pulse bg-emerald-400" : "bg-slate-400"
                }`}
              />
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                Cảnh {currentSlot.category.toUpperCase()} ({activeSlotIndex + 1}/{slots.length})
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            {currentSlot.flipH ? (
              <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/30 px-1.5 py-0.5 text-fuchsia-200">
                MIRROR
              </span>
            ) : null}
            <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-slate-300">
              {currentSlot.speed}x
            </span>
          </div>
        </div>

        {/* Video Elements */}
        <div
          onClick={onTogglePlay}
          className="absolute inset-0 flex cursor-pointer items-center justify-center overflow-hidden bg-black"
        >
          {hasAnyMedia ? (
            <>
              <video
                ref={videoRefA}
                muted
                playsInline
                preload="auto"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-100 ${
                  isVideoAActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                }`}
                style={{
                  transform: isVideoAActive ? `scaleX(${String(flipScaleX)})` : undefined,
                }}
              />
              {!isSlotMode ? (
                <video
                  ref={videoRefB}
                  muted
                  playsInline
                  preload="auto"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-100 ${
                    !isVideoAActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0"
                  }`}
                  style={{
                    transform: !isVideoAActive ? `scaleX(${String(flipScaleX)})` : undefined,
                  }}
                />
              ) : null}
            </>
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center p-5 text-center transition-all duration-150"
              style={{
                transform: `scaleX(${String(flipScaleX)})`,
                background:
                  "radial-gradient(circle at 50% 35%, rgba(244,63,94,0.22), rgba(15,23,42,0.95))",
              }}
            >
              <Text
                variant="caption"
                className="mb-2 text-xs tracking-widest text-slate-400 uppercase"
              >
                Simulated 9:16
              </Text>
              <Text variant="body" className="mb-1 px-2 text-sm font-bold text-white">
                {currentSlot.clipLabel}
              </Text>
              <Text variant="mono" className="text-xs text-slate-400">
                Source: {currentSlot.videoBegin.toFixed(1)}s → {currentSlot.videoEnd.toFixed(1)}s
              </Text>
            </div>
          )}

          {isBuffering && isPlaying ? (
            <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px]">
              <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-white/20 border-t-red-500 shadow-lg" />
              <Text
                variant="caption"
                className="mt-2.5 text-[11px] font-medium tracking-wide text-white/90 drop-shadow"
              >
                Đang tải video...
              </Text>
            </div>
          ) : null}
        </div>

        <audio ref={audioRef} preload="auto" muted={mutedVoice || !enableVoice} />

        {/* Bottom Overlay with YouTube-style Scrubber Bar */}
        <div className="relative z-20 space-y-1.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3">
          {isSlotMode && isoSlot ? (
            <div className="flex items-center justify-between text-[11px] text-slate-200">
              <span className="max-w-[160px] truncate font-medium text-rose-300">
                {isoSlot.clipLabel}
              </span>
              <span className="font-mono text-[10px] font-bold text-amber-300">
                Cắt: {isoSlot.videoBegin.toFixed(1)}s–
                {isoSlot.videoEnd.toFixed(1)}s
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-200">
              <span className="max-w-[170px] truncate font-medium">{currentSlot.clipLabel}</span>
              <span className="font-mono text-[10px] text-slate-400">
                {currentSlot.videoBegin.toFixed(1)}s–
                {currentSlot.videoEnd.toFixed(1)}s
              </span>
            </div>
          )}

          {/* YouTube-Style Interactive Progress Bar with Chapter Markers */}
          <div
            ref={progressBarRef}
            onPointerMove={(e) => {
              setHoverSec(computeSecFromPointer(e.clientX));
              if (isDraggingBar) {
                onBarSeek(computeSecFromPointer(e.clientX));
              }
            }}
            onPointerLeave={() => {
              if (!isDraggingBar) setHoverSec(null);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (typeof e.currentTarget.setPointerCapture === "function") {
                e.currentTarget.setPointerCapture(e.pointerId);
              }
              onDraggingBarChange(true);
              onBarSeek(computeSecFromPointer(e.clientX));
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              if (
                typeof e.currentTarget.hasPointerCapture === "function" &&
                e.currentTarget.hasPointerCapture(e.pointerId)
              ) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              onDraggingBarChange(false);
              setHoverSec(null);
            }}
            className="group/bar relative w-full cursor-pointer touch-none py-2 select-none"
          >
            {hoverSlotLabel ? (
              <div
                style={{ left: `${String(hoverPct)}%` }}
                className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded border border-slate-700 bg-slate-900/95 px-1.5 py-0.5 font-mono text-[9px] font-bold whitespace-nowrap text-white shadow-lg"
              >
                {hoverSlotLabel}
              </div>
            ) : null}

            <div className="relative h-1.5 w-full overflow-visible rounded-full bg-white/25 transition-all duration-150 group-hover/bar:h-2.5">
              {hoverSec !== null ? (
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-white/30"
                  style={{ width: `${String(hoverPct)}%` }}
                />
              ) : null}

              <div
                className={`pointer-events-none absolute inset-y-0 left-0 rounded-full ${
                  isSlotMode ? "bg-amber-400" : "bg-gradient-to-r from-rose-500 to-red-500"
                }`}
                style={{ width: `${String(progressPct)}%` }}
              />

              {!isSlotMode
                ? slots.slice(1).map((slot, idx) => {
                    const tickPct = Math.max(
                      0,
                      Math.min(100, (slot.enterBegin / totalDuration) * 100),
                    );
                    return (
                      <div
                        key={`tick_${slot.category}_${String(idx)}`}
                        style={{ left: `${String(tickPct)}%` }}
                        className="pointer-events-none absolute inset-y-0 z-10 w-[2px] -translate-x-1/2 bg-slate-950/90"
                      />
                    );
                  })
                : null}

              <div
                style={{ left: `${String(progressPct)}%` }}
                className={`pointer-events-none absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md ring-2 ring-white transition-transform duration-100 ${
                  isSlotMode ? "bg-amber-400" : "bg-red-500"
                } ${isDraggingBar ? "scale-125" : "scale-90 group-hover/bar:scale-110"}`}
              />
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1.5">
              <IconButton
                size="sm"
                variant="secondary"
                aria-label={isPlaying ? "Tạm dừng" : "Phát"}
                onPress={onTogglePlay}
                className="h-7 w-7 rounded-lg bg-white text-slate-950 shadow hover:bg-rose-100"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </IconButton>

              <IconButton
                size="sm"
                variant="secondary"
                aria-label="Phát lại từ đầu"
                onPress={onRestart}
                className="h-7 w-7 rounded-lg bg-slate-800/80 text-slate-200 hover:bg-slate-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </IconButton>

              {!isSlotMode && enableVoice && hasVoiceTrack ? (
                <IconButton
                  size="sm"
                  variant="secondary"
                  aria-label="Bật/tắt tiếng voice"
                  onPress={onToggleMuteVoice}
                  className="h-7 w-7 rounded-lg bg-slate-800/80 text-slate-200 hover:bg-slate-700"
                >
                  {mutedVoice ? (
                    <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </IconButton>
              ) : null}
            </div>

            {isSlotMode && isoSlot ? (
              <div className="font-mono text-[11px] font-bold text-amber-300">
                {Math.max(0, (slotCurrentSec - isoSlot.videoBegin) / (isoSlot.speed || 1)).toFixed(
                  1,
                )}
                s / {((isoSlot.videoEnd - isoSlot.videoBegin) / (isoSlot.speed || 1)).toFixed(1)}s
              </div>
            ) : (
              <div className="font-mono text-[11px] text-slate-300">
                {timelineSec.toFixed(1)}s / {totalDuration.toFixed(1)}s
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
