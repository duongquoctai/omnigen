"use client";

import { FlipHorizontal, Play, X } from "lucide-react";

import { IPhoneVideoTrimmer } from "@/contexts/footage";
import type { ShotCategory } from "@/contexts/shared-kernel";
import { Button, IconButton, RangeSlider, SurfaceBox, Text } from "@/shared/ui";

import type { PlannedSlotEdits } from "../domain/planner";
import type { PlannedSlot } from "../domain/types";

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

const INSPECTOR_CATEGORY_STYLE: Readonly<
  Record<
    ShotCategory,
    {
      readonly border: string;
      readonly badge: string;
    }
  >
> = {
  open: {
    border: "border-rose-500/40",
    badge: "border-rose-500/30 bg-rose-500/20 text-rose-300",
  },
  product: {
    border: "border-blue-500/40",
    badge: "border-blue-500/30 bg-blue-500/20 text-blue-300",
  },
  texture: {
    border: "border-amber-500/40",
    badge: "border-amber-500/30 bg-amber-500/20 text-amber-300",
  },
  apply: {
    border: "border-emerald-500/40",
    badge: "border-emerald-500/30 bg-emerald-500/20 text-emerald-300",
  },
  end: {
    border: "border-violet-500/40",
    badge: "border-violet-500/30 bg-violet-500/20 text-violet-300",
  },
};

export interface PlannedSlotInspectorProps {
  readonly slot: PlannedSlot;
  readonly slotIndex: number;
  readonly canEdit: boolean;
  readonly onUpdateSlot: (slotIndex: number, edits: PlannedSlotEdits) => void;
  readonly onPreviewSlot: (slotIndex: number) => void;
  readonly onClose: () => void;
  readonly onScrubStart: (slotIndex: number) => void;
  readonly onScrubMove: (sourceSec: number) => void;
  readonly onScrubEnd: () => void;
  readonly onSeekPreview: (slotIndex: number, targetSec: number) => void;
}

export function PlannedSlotInspector({
  slot,
  slotIndex,
  canEdit,
  onUpdateSlot,
  onPreviewSlot,
  onClose,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  onSeekPreview,
}: PlannedSlotInspectorProps) {
  const maxDuration = Math.max(0.5, (slot.originalVideoEnd ?? slot.videoEnd) || 10);
  const cutLen = Math.max(0.1, slot.videoEnd - slot.videoBegin);
  const effectiveLen = cutLen / Math.max(0.1, slot.speed);
  const catStyle = INSPECTOR_CATEGORY_STYLE[slot.category];

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
      }}
      className={`mt-3 space-y-3 rounded-xl border bg-[#070811] p-3.5 ${catStyle.border}`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-bold uppercase ${catStyle.badge}`}
          >
            Cảnh {slot.category}
          </span>
          <Text variant="body" className="max-w-[180px] truncate text-xs text-slate-200">
            {slot.clipLabel}
          </Text>
          <Text variant="mono" className="hidden text-[10px] text-slate-400 sm:inline">
            (Gốc: {maxDuration.toFixed(1)}s)
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={slot.flipH ? "primary" : "secondary"}
            isDisabled={!canEdit}
            onPress={() => {
              onUpdateSlot(slotIndex, { flipH: !slot.flipH });
            }}
            className={`h-7 rounded-md border px-2.5 text-[10px] font-semibold ${
              slot.flipH
                ? "border-indigo-500/60 bg-indigo-600/30 text-indigo-300"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <FlipHorizontal className="h-3.5 w-3.5" />
            {slot.flipH ? "Đang lật gương" : "Lật gương"}
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              onPreviewSlot(slotIndex);
            }}
            className="h-7 rounded-md bg-slate-800 px-2.5 text-[10px] text-slate-200 hover:bg-slate-700"
          >
            <Play className="h-3 w-3 fill-current text-rose-400" />
            Xem đoạn này
          </Button>

          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Thu gọn bảng chỉnh sửa"
            onPress={onClose}
            className="h-7 w-7 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* 3-Column Grid: Speed (1 col) + IPhoneVideoTrimmer (2 cols) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SurfaceBox className="flex flex-col justify-between space-y-1.5 rounded-lg border-zinc-800 bg-[#070811] p-2.5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Text variant="label" className="text-[11px] font-semibold text-slate-300">
                Tốc độ phát:
              </Text>
              <Text variant="mono" className="text-xs font-bold text-indigo-400">
                {slot.speed}x
              </Text>
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-1">
              {SPEED_PRESETS.map((spd) => {
                const isActive = Math.abs(slot.speed - spd) < 0.02;
                return (
                  <Button
                    key={spd}
                    size="sm"
                    variant={isActive ? "primary" : "secondary"}
                    isDisabled={!canEdit}
                    onPress={() => {
                      onUpdateSlot(slotIndex, { speed: spd });
                    }}
                    className={`h-6 min-w-0 rounded px-1.5 font-mono text-[10px] ${
                      isActive
                        ? "bg-indigo-600 font-bold text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {spd}x
                  </Button>
                );
              })}
            </div>

            <RangeSlider
              ariaLabel="Tốc độ phát"
              min={0.25}
              max={3.0}
              step={0.05}
              value={slot.speed}
              isDisabled={!canEdit}
              onValueChange={(val) => {
                onUpdateSlot(slotIndex, { speed: val });
              }}
            />
          </div>

          <div className="pt-1">
            <Text variant="mono" className="text-[10px] text-slate-400">
              Cắt {cutLen.toFixed(1)}s ÷ {slot.speed}x ={" "}
              <span className="font-bold text-emerald-400">{effectiveLen.toFixed(1)}s</span>
            </Text>
          </div>
        </SurfaceBox>

        <div className="sm:col-span-2">
          <IPhoneVideoTrimmer
            videoBegin={slot.videoBegin}
            videoEnd={slot.videoEnd}
            totalDuration={maxDuration}
            disabled={!canEdit}
            onChange={(begin, end) => {
              onUpdateSlot(slotIndex, { videoBegin: begin, videoEnd: end });
            }}
            onScrubStart={() => {
              onScrubStart(slotIndex);
            }}
            onScrubMove={onScrubMove}
            onScrubEnd={onScrubEnd}
            onSeekPreview={(targetSec) => {
              onSeekPreview(slotIndex, targetSec);
            }}
          />
        </div>
      </div>
    </div>
  );
}
