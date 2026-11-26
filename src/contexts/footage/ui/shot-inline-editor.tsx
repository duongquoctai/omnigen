"use client";

import { FlipHorizontal2, Lock, Play, Sliders, Trash2, Unlock, X } from "lucide-react";

import type { ShotCategory, ShotId } from "@/contexts/shared-kernel";
import {
  Button,
  IconButton,
  RangeSlider,
  StatusChip,
  SurfaceBox,
  Text,
  TextInput,
} from "@/shared/ui";

import type { CategoryMinDurations, Shot, Speed, Zoom, ZoomDepth } from "../domain/types";
import { CATEGORY_META_LIST, CATEGORY_META_MAP } from "./category-meta";
import { IPhoneVideoTrimmer } from "./iphone-video-trimmer";

export interface ShotInlineEditorProps {
  readonly shot: Shot;
  readonly minDurations: CategoryMinDurations;
  readonly maxVideoDuration: number;
  readonly canEdit: boolean;
  readonly onClose: () => void;
  readonly onRenameShot: (shotId: ShotId, label: string) => void;
  readonly onToggleFlip: (shotId: ShotId) => void;
  readonly onToggleFlipLock: (shotId: ShotId) => void;
  readonly onSetSpeed: (shotId: ShotId, speed: Speed) => void;
  readonly onSetZoom: (shotId: ShotId, zoom: Zoom) => void;
  readonly onClassifyShot: (shotId: ShotId, category: ShotCategory) => void;
  readonly onTrimShot: (shotId: ShotId, begin: number, end: number) => void;
  readonly onDeleteShot: (shotId: ShotId) => void;
  readonly onPlayShot: (shot: Shot) => void;
  readonly onSeekPreview: (time: number) => void;
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const;

export function ShotInlineEditor({
  shot,
  minDurations,
  maxVideoDuration,
  canEdit,
  onClose,
  onRenameShot,
  onToggleFlip,
  onToggleFlipLock,
  onSetSpeed,
  onSetZoom,
  onClassifyShot,
  onTrimShot,
  onDeleteShot,
  onPlayShot,
  onSeekPreview,
}: ShotInlineEditorProps) {
  const cutDur = Math.max(0.1, shot.range.end - shot.range.begin);
  const effDur = Math.max(0.1, Math.round((cutDur / shot.edits.speed) * 10) / 10);
  const rawOrigDur = Math.max(0.1, shot.detectedRange.end - shot.detectedRange.begin);
  const currentCat = shot._tag === "ClassifiedShot" ? shot.category : null;
  const catMeta = currentCat ? CATEGORY_META_MAP[currentCat] : null;
  const minDur = currentCat ? minDurations[currentCat] : 3;
  const isFlipped = shot.edits.flip._tag === "Flipped";
  const isLocked = shot.edits.flip.locked;

  const zoomDepth =
    shot.edits.zoom._tag === "FixedZoom"
      ? shot.edits.zoom.depth
      : shot.edits.zoom._tag === "AutoZoom"
        ? 1.2
        : 1.0;

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <StatusChip color={catMeta?.chipColor ?? "default"} variant="soft" size="sm">
            CẢNH {catMeta?.folderName ?? "CHƯA GÁN"}
          </StatusChip>
          <TextInput
            aria-label="Tên cảnh"
            value={shot.label}
            onChange={(e) => {
              onRenameShot(shot.id, e.target.value);
            }}
            disabled={!canEdit}
            className="h-7 max-w-[200px] rounded-md border-zinc-800 bg-zinc-900 px-2 text-xs font-semibold text-white"
          />
          <Text variant="mono" className="hidden text-[11px] text-zinc-400 sm:inline">
            (Gốc: {rawOrigDur.toFixed(1)}s)
          </Text>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant={isFlipped ? "primary" : "secondary"}
            isDisabled={!canEdit}
            onPress={() => {
              onToggleFlip(shot.id);
            }}
            className="h-7 rounded-md px-2.5 text-xs"
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            {isFlipped ? "Đang lật gương" : "Lật gương"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              onPlayShot(shot);
            }}
            className="h-7 rounded-md px-2.5 text-xs"
          >
            <Play className="h-3 w-3 text-indigo-400" />
            Xem đoạn này
          </Button>
          <IconButton
            aria-label="Đóng bảng chỉnh sửa"
            size="sm"
            variant="ghost"
            onPress={onClose}
            className="h-7 w-7 rounded-md"
          >
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* 3-Column Grid: Speed (1 col) + IPhoneVideoTrimmer (2 cols) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SurfaceBox className="flex flex-col justify-between gap-2.5 border-zinc-800 bg-[#070811] p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Text variant="label" className="text-[11px] font-semibold text-zinc-200">
                Tốc độ phát:
              </Text>
              <Text variant="mono" className="text-xs font-bold text-indigo-400">
                {shot.edits.speed}x
              </Text>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {SPEED_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  size="sm"
                  variant={Math.abs(shot.edits.speed - preset) < 0.02 ? "primary" : "secondary"}
                  isDisabled={!canEdit}
                  onPress={() => {
                    onSetSpeed(shot.id, preset as Speed);
                  }}
                  className="h-6 min-w-0 rounded-md px-2 font-mono text-[10px]"
                >
                  {preset}x
                </Button>
              ))}
            </div>

            <RangeSlider
              ariaLabel="Tốc độ tuỳ chỉnh"
              value={shot.edits.speed}
              onValueChange={(val) => {
                onSetSpeed(shot.id, val as Speed);
              }}
              min={0.25}
              max={3.0}
              step={0.05}
              isDisabled={!canEdit}
            />
          </div>

          <div className="border-t border-zinc-800/80 pt-1.5">
            <Text variant="mono" className="text-[10px] text-zinc-400">
              Cắt {cutDur.toFixed(1)}s ÷ {shot.edits.speed}x ={" "}
              <span
                className={`font-bold ${effDur >= minDur ? "text-emerald-400" : "text-amber-400"}`}
              >
                {effDur.toFixed(1)}s
              </span>
            </Text>
          </div>
        </SurfaceBox>

        <div className="sm:col-span-2">
          <IPhoneVideoTrimmer
            videoBegin={shot.range.begin}
            videoEnd={shot.range.end}
            totalDuration={maxVideoDuration}
            rawBegin={shot.detectedRange.begin}
            rawEnd={shot.detectedRange.end}
            disabled={!canEdit}
            onSeekPreview={onSeekPreview}
            onChange={(b, e) => {
              if (canEdit) {
                onTrimShot(shot.id, b, e);
              }
            }}
          />
        </div>
      </div>

      {/* Advanced Options */}
      <SurfaceBox className="space-y-2.5 border-zinc-800 bg-[#070811] p-3">
        <div className="flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-indigo-400" />
          <Text variant="label" className="text-[11px] font-semibold text-zinc-200">
            Tùy chọn nâng cao
          </Text>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Button
            fullWidth
            size="sm"
            variant={isLocked ? "secondary" : "ghost"}
            isDisabled={!canEdit}
            onPress={() => {
              onToggleFlipLock(shot.id);
            }}
            className={`flex h-auto items-center justify-between rounded-lg border px-3 py-2 ${
              isLocked
                ? "border-amber-500/60 bg-amber-500/15 text-amber-200"
                : "border-zinc-800 bg-[#0b0d18] text-zinc-300"
            }`}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
              {isLocked ? (
                <Lock className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-zinc-500" />
              )}
              Khoá chữ (L)
            </span>
            <Text variant="mono" className="text-[10px] font-bold">
              {isLocked ? "LOCKED" : "FREE"}
            </Text>
          </Button>

          <SurfaceBox className="flex flex-col justify-between gap-1 border-zinc-800 bg-[#0b0d18] px-3 py-2">
            <div className="flex items-center justify-between">
              <Text variant="caption" className="text-[11px] text-zinc-400">
                Ken Burns zoom
              </Text>
              <Text variant="mono" className="text-[11px] font-bold text-zinc-200">
                {zoomDepth > 1.01 ? `${zoomDepth.toFixed(2).replace(/\.00$/, "")}x` : "Tắt"}
              </Text>
            </div>
            <RangeSlider
              ariaLabel="Ken Burns zoom"
              min={1.0}
              max={1.5}
              step={0.05}
              value={zoomDepth}
              isDisabled={!canEdit}
              onValueChange={(depth) => {
                onSetZoom(
                  shot.id,
                  depth <= 1.01
                    ? { _tag: "NoZoom" }
                    : { _tag: "FixedZoom", depth: depth as ZoomDepth },
                );
              }}
            />
          </SurfaceBox>

          <Button
            fullWidth
            size="sm"
            variant="danger-soft"
            isDisabled={!canEdit}
            onPress={() => {
              onDeleteShot(shot.id);
              onClose();
            }}
            className="h-auto rounded-lg py-2 text-xs font-semibold"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xoá cảnh này
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-800/80 pt-2">
          <Text variant="caption" className="shrink-0 text-[11px] text-zinc-400">
            Chuyển sang nhóm:
          </Text>
          {CATEGORY_META_LIST.map((c) => {
            const isCurrent = currentCat === c.id;
            return (
              <Button
                key={c.id}
                size="sm"
                variant={isCurrent ? "primary" : "secondary"}
                isDisabled={!canEdit || isCurrent}
                onPress={() => {
                  onClassifyShot(shot.id, c.id);
                }}
                className="h-6 rounded-md px-2 text-[10px] font-semibold"
              >
                {c.hotkey}. {c.folderName}
              </Button>
            );
          })}
        </div>
      </SurfaceBox>
    </div>
  );
}
