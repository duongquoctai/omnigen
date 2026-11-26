"use client";

import { Option } from "effect";
import { Check, Download, Mic, Pause, Play } from "lucide-react";

import type { ShotCategory } from "@/contexts/shared-kernel";
import { Button, IconButton, SelectField, Text } from "@/shared/ui";

import type { PlannedSlotEdits } from "../domain/planner";
import type { PlannedVideo, VoiceClip } from "../domain/types";
import { PlannedSlotInspector } from "./planned-slot-inspector";

const NO_VOICE_VALUE = "__no_voice__";

const SLOT_CATEGORY_STYLE: Readonly<
  Record<
    ShotCategory,
    {
      readonly activeBorder: string;
      readonly labelText: string;
      readonly durationText: string;
    }
  >
> = {
  open: {
    activeBorder: "border-rose-500 ring-1 ring-rose-500/50",
    labelText: "text-rose-300",
    durationText: "text-rose-300",
  },
  product: {
    activeBorder: "border-blue-500 ring-1 ring-blue-500/50",
    labelText: "text-blue-300",
    durationText: "text-blue-300",
  },
  texture: {
    activeBorder: "border-amber-500 ring-1 ring-amber-500/50",
    labelText: "text-amber-300",
    durationText: "text-amber-300",
  },
  apply: {
    activeBorder: "border-emerald-500 ring-1 ring-emerald-500/50",
    labelText: "text-emerald-300",
    durationText: "text-emerald-300",
  },
  end: {
    activeBorder: "border-violet-500 ring-1 ring-violet-500/50",
    labelText: "text-violet-300",
    durationText: "text-violet-300",
  },
};

export interface PlannedVideoCardProps {
  readonly video: PlannedVideo;
  readonly index: number;
  readonly isSelected: boolean;
  readonly isDimmed?: boolean | undefined;
  readonly isRendered: boolean;
  readonly isCardPlaying: boolean;
  readonly editingSlotCategory: ShotCategory | null;
  readonly voices: ReadonlyArray<VoiceClip>;
  readonly canEdit: boolean;
  readonly canExport: boolean;
  readonly isRenderingBatch: boolean;
  readonly onSelectVideo: (videoId: string) => void;
  readonly onTogglePlayFull: (videoId: string, isCurrentlyPlaying: boolean) => void;
  readonly onRenderSingle: (video: PlannedVideo) => void;
  readonly onToggleSlotCategory: (
    videoId: string,
    category: ShotCategory,
    slotIndex: number,
  ) => void;
  readonly onCloseSlotInspector: () => void;
  readonly onChangeVoice: (videoId: string, voiceId: string | null) => void;
  readonly onUpdateSlot: (videoId: string, slotIndex: number, edits: PlannedSlotEdits) => void;
  readonly onPreviewSlot: (videoId: string, slotIndex: number) => void;
  readonly onScrubStart: (videoId: string, slotIndex: number) => void;
  readonly onScrubMove: (sourceSec: number) => void;
  readonly onScrubEnd: () => void;
  readonly onSeekPreview: (videoId: string, slotIndex: number, targetSec: number) => void;
}

export function PlannedVideoCard({
  video,
  index,
  isSelected,
  isDimmed = false,
  isRendered,
  isCardPlaying,
  editingSlotCategory,
  voices,
  canEdit,
  canExport,
  isRenderingBatch,
  onSelectVideo,
  onTogglePlayFull,
  onRenderSingle,
  onToggleSlotCategory,
  onCloseSlotInspector,
  onChangeVoice,
  onUpdateSlot,
  onPreviewSlot,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
  onSeekPreview,
}: PlannedVideoCardProps) {
  const activeSlotIdx =
    isSelected && editingSlotCategory
      ? video.slots.findIndex((s) => s.category === editingSlotCategory)
      : -1;
  const activeSlot = activeSlotIdx >= 0 ? (video.slots.at(activeSlotIdx) ?? null) : null;

  const currentVoiceValue = Option.isSome(video.voiceId) ? video.voiceId.value : NO_VOICE_VALUE;

  const voiceOptions = [
    { value: NO_VOICE_VALUE, label: "(Không lồng voice)" },
    ...voices.map((v) => ({
      value: v.id,
      label: `🎵 ${v.name} (${v.duration.toFixed(1)}s)`,
    })),
  ];

  const totalSlotsDuration = video.slots.reduce(
    (sum, s) => sum + Math.max(0.1, s.exitEnd - s.enterBegin),
    0,
  );

  return (
    <div
      onClick={() => {
        onSelectVideo(video.id);
      }}
      className={`cursor-pointer rounded-xl border border-slate-800 bg-[#070811] p-3.5 transition-all duration-200 hover:border-slate-700 ${
        isDimmed ? "opacity-50 hover:opacity-90" : "opacity-100"
      }`}
    >
      {/* Top Row: Title + Duration Badge + Rendered Badge + Play/Download Actions */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-white">
          <span>
            #{index + 1} — {video.name}
          </span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
            ⏱️ Tổng: {video.finalDuration.toFixed(1)}s
          </span>
          {isRendered ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              <Check className="h-3 w-3 stroke-[2.5] text-emerald-400" />
              <span>Đã render</span>
            </span>
          ) : null}
        </div>

        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="flex shrink-0 items-center gap-1.5"
        >
          <IconButton
            size="sm"
            variant="primary"
            aria-label={isCardPlaying ? "Tạm dừng" : "Phát video"}
            onPress={() => {
              onTogglePlayFull(video.id, isCardPlaying);
            }}
            className={`h-8 w-8 rounded-lg text-white shadow-md transition ${
              isCardPlaying
                ? "bg-amber-600 shadow-amber-600/20 hover:bg-amber-500"
                : "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500"
            }`}
          >
            {isCardPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
          </IconButton>

          {canExport ? (
            <IconButton
              size="sm"
              variant="danger"
              aria-label="Xuất file MP4"
              isDisabled={isRenderingBatch}
              onPress={() => {
                onRenderSingle(video);
              }}
              className="h-8 w-8 rounded-lg bg-rose-600 text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-500"
            >
              <Download className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
        </div>
      </div>

      {/* 5 Slots Proportional Timeline Bar */}
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="flex w-full gap-1.5"
      >
        {video.slots.map((slot, sIdx) => {
          const slotDurNum = Math.max(0.1, slot.exitEnd - slot.enterBegin);
          const slotDur = slotDurNum.toFixed(1);
          const widthPct =
            totalSlotsDuration > 0
              ? (slotDurNum / totalSlotsDuration) * 100
              : 100 / Math.max(1, video.slots.length);
          const isSlotActive = isSelected && editingSlotCategory === slot.category;
          const catStyle = SLOT_CATEGORY_STYLE[slot.category];

          return (
            <div
              key={`${video.id}_${slot.category}`}
              style={{ flex: `0 1 ${widthPct.toFixed(2)}%` }}
              className="min-w-0"
            >
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  onToggleSlotCategory(video.id, slot.category, sIdx);
                }}
                className={`h-auto w-full min-w-0 flex-col items-stretch justify-start rounded-lg border bg-[#0b0d18] p-1.5 text-left text-[10px] font-normal transition hover:bg-[#0b0d18] ${
                  isSlotActive ? catStyle.activeBorder : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1 font-bold uppercase">
                  <span
                    className={`truncate ${catStyle.labelText} ${
                      isSlotActive ? "font-extrabold" : ""
                    }`}
                  >
                    {slot.category}
                  </span>
                  <span className={`shrink-0 font-mono font-bold ${catStyle.durationText}`}>
                    {slotDur}s
                  </span>
                </div>
                <div
                  className="mt-0.5 w-full truncate text-[9px] text-slate-400"
                  title={slot.clipLabel}
                >
                  {slot.clipLabel}
                </div>
                <div className="mt-0.5 flex w-full items-center justify-between gap-1 font-mono text-[9px] text-slate-500">
                  <span className="truncate">
                    {slot.videoBegin.toFixed(1)}s–{slot.videoEnd.toFixed(1)}s
                  </span>
                  <span
                    className={
                      slot.speed > 1
                        ? "shrink-0 font-semibold text-cyan-400"
                        : slot.speed < 1
                          ? "shrink-0 font-semibold text-amber-400"
                          : "shrink-0 text-slate-400"
                    }
                  >
                    {slot.speed}x
                  </span>
                </div>
              </Button>
            </div>
          );
        })}
      </div>

      {/* Voice Track Selector Row */}
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]"
      >
        <div className="flex items-center gap-1.5 text-slate-400">
          <Mic className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
          <Text variant="caption" className="text-[10px] text-slate-300">
            Lồng tiếng:
          </Text>
        </div>

        <SelectField
          ariaLabel={`Lồng tiếng cho ${video.name}`}
          value={currentVoiceValue}
          isDisabled={!canEdit}
          onValueChange={(nextVal) => {
            onChangeVoice(video.id, nextVal === NO_VOICE_VALUE ? null : nextVal);
          }}
          options={voiceOptions}
          className="w-48"
        />
      </div>

      {/* Inline Scene Inspector */}
      {isSelected && activeSlot && activeSlotIdx >= 0 ? (
        <PlannedSlotInspector
          slot={activeSlot}
          slotIndex={activeSlotIdx}
          canEdit={canEdit}
          onUpdateSlot={(sIdx, edits) => {
            onUpdateSlot(video.id, sIdx, edits);
          }}
          onPreviewSlot={(sIdx) => {
            onPreviewSlot(video.id, sIdx);
          }}
          onClose={onCloseSlotInspector}
          onScrubStart={(sIdx) => {
            onScrubStart(video.id, sIdx);
          }}
          onScrubMove={onScrubMove}
          onScrubEnd={onScrubEnd}
          onSeekPreview={(sIdx, targetSec) => {
            onSeekPreview(video.id, sIdx, targetSec);
          }}
        />
      ) : null}
    </div>
  );
}
