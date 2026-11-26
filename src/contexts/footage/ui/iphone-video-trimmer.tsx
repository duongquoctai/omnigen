"use client";

import { RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button, NumberInput, StatusChip, SurfaceBox, Text } from "@/shared/ui";

import { useTrimHandles } from "./use-trim-handles";

export interface IPhoneVideoTrimmerProps {
  readonly videoBegin: number;
  readonly videoEnd: number;
  readonly totalDuration: number;
  readonly rawBegin?: number | undefined;
  readonly rawEnd?: number | undefined;
  readonly contextPadding?: number | undefined;
  readonly step?: number | undefined;
  readonly minClipDuration?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly onChange: (begin: number, end: number) => void;
  readonly onSeekPreview?: ((targetSec: number) => void) | undefined;
  readonly onScrubStart?: (() => void) | undefined;
  readonly onScrubMove?: ((sourceSec: number) => void) | undefined;
  readonly onScrubEnd?: (() => void) | undefined;
}

const formatSec = (sec: number): string => `${sec.toFixed(1)}s`;

export function IPhoneVideoTrimmer({
  videoBegin,
  videoEnd,
  totalDuration,
  rawBegin,
  rawEnd,
  contextPadding = 6.0,
  step = 0.1,
  minClipDuration = 0.2,
  disabled = false,
  onChange,
  onSeekPreview,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
}: IPhoneVideoTrimmerProps) {
  const { trackRef, activeHandle, metrics, startDrag, moveDrag, endDrag } = useTrimHandles({
    videoBegin,
    videoEnd,
    totalDuration,
    ...(rawBegin !== undefined ? { rawBegin } : {}),
    ...(rawEnd !== undefined ? { rawEnd } : {}),
    contextPadding,
    minClipDuration,
    step,
    onChange,
    ...(onScrubStart ? { onScrubStart } : {}),
    ...(onScrubMove ? { onScrubMove } : {}),
    ...(onScrubEnd ? { onScrubEnd } : {}),
  });

  useEffect(() => {
    if (!activeHandle) return;
    const handleMouseMove = (e: MouseEvent) => {
      moveDrag(e.clientX, activeHandle);
    };
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches.item(0);
      if (touch) moveDrag(touch.clientX, activeHandle);
    };
    const handleUp = () => {
      endDrag();
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchend", handleUp);
    };
  }, [activeHandle, moveDrag, endDrag]);

  const hasRaw = rawBegin !== undefined && rawEnd !== undefined;
  const canReset = hasRaw
    ? Math.abs(videoBegin - rawBegin) > 0.05 || Math.abs(videoEnd - rawEnd) > 0.05
    : true;

  const selectedDuration = Math.max(0, metrics.safeEnd - metrics.safeBegin);

  const roundTenths = (n: number): number => Math.round(n * 10) / 10;
  const nudgeBegin = (delta: number) => {
    const nextBegin = roundTenths(
      Math.max(0, Math.min(metrics.safeEnd - minClipDuration, metrics.safeBegin + delta)),
    );
    onChange(nextBegin, metrics.safeEnd);
    onSeekPreview?.(nextBegin);
  };
  const nudgeEnd = (delta: number) => {
    const nextEnd = roundTenths(
      Math.min(
        metrics.safeTotal,
        Math.max(metrics.safeBegin + minClipDuration, metrics.safeEnd + delta),
      ),
    );
    onChange(metrics.safeBegin, nextEnd);
    onSeekPreview?.(nextEnd);
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-zinc-800 bg-[#070811] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-300">
        <div className="flex items-center gap-2">
          <Text variant="label" className="text-[11px] font-semibold text-zinc-200">
            Cắt bớt đầu / cuối (Kéo 2 đầu):
          </Text>
          <StatusChip color="warning" variant="soft" size="sm">
            {formatSec(selectedDuration)}
          </StatusChip>
        </div>

        <div className="flex items-center gap-1.5">
          {onSeekPreview ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                onSeekPreview(metrics.safeBegin);
              }}
              className="h-6 rounded-md px-2 text-[10px] text-indigo-300"
            >
              Xem đầu cảnh
            </Button>
          ) : null}
          {canReset && !disabled ? (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                if (hasRaw) {
                  onChange(rawBegin, rawEnd);
                  onSeekPreview?.(rawBegin);
                } else {
                  onChange(0, metrics.safeTotal);
                  onSeekPreview?.(0);
                }
              }}
              className="h-6 rounded-md px-2 text-[10px] text-zinc-300"
            >
              <RotateCcw className="h-3 w-3" />
              {hasRaw ? "Về cảnh gốc" : "Trọn cảnh"}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative h-9 overflow-hidden rounded-lg border border-white/15 bg-zinc-900/90 select-none"
      >
        <div className="absolute inset-y-0 right-0 left-0 flex items-center justify-between px-2 font-mono text-[9px] text-zinc-500">
          <span>{formatSec(metrics.windowStart)}</span>
          <span>{formatSec(metrics.windowEnd)}</span>
        </div>

        <div
          role="slider"
          aria-label="Vùng chọn cảnh"
          aria-valuemin={0}
          aria-valuemax={metrics.safeTotal}
          aria-valuenow={metrics.safeBegin}
          tabIndex={0}
          onMouseDown={(e) => {
            if (!disabled) startDrag(e.clientX, "middle");
          }}
          onTouchStart={(e) => {
            const touch = Array.from(e.touches).at(0);
            if (!disabled && touch) {
              startDrag(touch.clientX, "middle");
            }
          }}
          style={{
            left: `${String(metrics.beginPercent)}%`,
            width: `${String(Math.max(4, metrics.widthPercent))}%`,
          }}
          className="absolute inset-y-0 cursor-grab border-y-2 border-amber-400 bg-amber-400/20 active:cursor-grabbing"
        >
          <div
            role="slider"
            aria-label="Điểm bắt đầu cảnh"
            aria-valuemin={0}
            aria-valuemax={metrics.safeEnd}
            aria-valuenow={metrics.safeBegin}
            tabIndex={0}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!disabled) startDrag(e.clientX, "begin");
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = Array.from(e.touches).at(0);
              if (!disabled && touch) {
                startDrag(touch.clientX, "begin");
              }
            }}
            className="absolute inset-y-0 left-0 flex w-3 cursor-ew-resize items-center justify-center bg-amber-400 text-zinc-950"
          >
            <span className="h-4 w-0.5 rounded bg-zinc-900" />
          </div>

          <div
            role="slider"
            aria-label="Điểm kết thúc cảnh"
            aria-valuemin={metrics.safeBegin}
            aria-valuemax={metrics.safeTotal}
            aria-valuenow={metrics.safeEnd}
            tabIndex={0}
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!disabled) startDrag(e.clientX, "end");
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const touch = Array.from(e.touches).at(0);
              if (!disabled && touch) {
                startDrag(touch.clientX, "end");
              }
            }}
            className="absolute inset-y-0 right-0 flex w-3 cursor-ew-resize items-center justify-center bg-amber-400 text-zinc-950"
          >
            <span className="h-4 w-0.5 rounded bg-zinc-900" />
          </div>
          <div className="pointer-events-none flex h-full items-center justify-center px-3">
            <Text variant="mono" className="truncate text-[10px] font-bold text-white">
              {formatSec(metrics.safeBegin)} → {formatSec(metrics.safeEnd)}
            </Text>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SurfaceBox className="flex items-center gap-1.5 border-zinc-800 bg-[#070811] px-2 py-1">
          <Text variant="caption" className="shrink-0 text-[11px] text-zinc-400">
            Đầu:
          </Text>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={disabled}
            onPress={() => {
              nudgeBegin(-0.1);
            }}
            className="h-6 min-w-0 rounded-md px-1.5 font-mono text-[10px]"
          >
            -0.1s
          </Button>
          <NumberInput
            ariaLabel="Mốc bắt đầu (giây)"
            value={metrics.safeBegin}
            onValueChange={(val) => {
              const clamped = roundTenths(
                Math.max(0, Math.min(metrics.safeEnd - minClipDuration, val)),
              );
              onChange(clamped, metrics.safeEnd);
            }}
            min={0}
            max={Math.max(0, metrics.safeEnd - minClipDuration)}
            step={0.1}
            isDisabled={disabled}
            showSteppers={false}
            className="w-14"
          />
          <Button
            size="sm"
            variant="secondary"
            isDisabled={disabled}
            onPress={() => {
              nudgeBegin(0.1);
            }}
            className="h-6 min-w-0 rounded-md px-1.5 font-mono text-[10px]"
          >
            +0.1s
          </Button>
        </SurfaceBox>

        <SurfaceBox className="flex items-center gap-1.5 border-zinc-800 bg-[#070811] px-2 py-1">
          <Text variant="caption" className="shrink-0 text-[11px] text-zinc-400">
            Cuối:
          </Text>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={disabled}
            onPress={() => {
              nudgeEnd(-0.1);
            }}
            className="h-6 min-w-0 rounded-md px-1.5 font-mono text-[10px]"
          >
            -0.1s
          </Button>
          <NumberInput
            ariaLabel="Mốc kết thúc (giây)"
            value={metrics.safeEnd}
            onValueChange={(val) => {
              const clamped = roundTenths(
                Math.min(metrics.safeTotal, Math.max(metrics.safeBegin + minClipDuration, val)),
              );
              onChange(metrics.safeBegin, clamped);
            }}
            min={metrics.safeBegin + minClipDuration}
            max={metrics.safeTotal}
            step={0.1}
            isDisabled={disabled}
            showSteppers={false}
            className="w-14"
          />
          <Button
            size="sm"
            variant="secondary"
            isDisabled={disabled}
            onPress={() => {
              nudgeEnd(0.1);
            }}
            className="h-6 min-w-0 rounded-md px-1.5 font-mono text-[10px]"
          >
            +0.1s
          </Button>
        </SurfaceBox>
      </div>
    </div>
  );
}
