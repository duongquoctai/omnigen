"use client";

import { FlipHorizontal, Lock, Merge, Scissors, Trash2, Unlock, ZoomIn } from "lucide-react";

import { SHOT_CATEGORY_VALUES, type ShotCategory } from "@/contexts/shared-kernel";
import { Button, Heading, NumberInput, Text } from "@/shared/ui";

import type { Shot, Speed } from "../domain/types";
import type { FootageAction } from "./footage-reducer";

const CATEGORY_LABELS: Readonly<Record<ShotCategory, string>> = {
  open: "1. Open",
  product: "2. Product",
  texture: "3. Texture",
  apply: "4. Apply",
  end: "5. End",
};

export interface ShotEditorPanelProps {
  readonly shot: Shot | null;
  readonly canEdit: boolean;
  readonly canMergeNext: boolean;
  readonly playheadSec: number;
  readonly onDispatch: (action: FootageAction) => void;
  readonly makeNewShotId: () => Shot["id"];
}

export function ShotEditorPanel({
  shot,
  canEdit,
  canMergeNext,
  playheadSec,
  onDispatch,
  makeNewShotId,
}: ShotEditorPanelProps) {
  if (!shot) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-zinc-400">
        Chọn một cảnh bên trái để chỉnh sửa thông số.
      </div>
    );
  }

  const activeCategory = shot._tag === "ClassifiedShot" ? shot.category : null;
  const isFlipped = shot.edits.flip._tag === "Flipped";
  const isFlipLocked = shot.edits.flip.locked;
  const isZoomed = shot.edits.zoom._tag !== "NoZoom";

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Heading level={3}>{shot.label}</Heading>
          <Text variant="caption" className="text-zinc-400">
            {shot.range.begin.toFixed(1)}s – {shot.range.end.toFixed(1)}s · Tốc độ{" "}
            {shot.edits.speed}x
          </Text>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!canEdit}
            onPress={() => {
              onDispatch({
                _tag: "SplitShot",
                shotId: shot.id,
                targetSec: playheadSec,
                newSecondId: makeNewShotId(),
              });
            }}
          >
            <Scissors className="h-3.5 w-3.5" />
            Tách đôi
          </Button>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!canEdit || !canMergeNext}
            onPress={() => {
              onDispatch({ _tag: "MergeWithNext", shotId: shot.id });
            }}
          >
            <Merge className="h-3.5 w-3.5" />
            Gộp cảnh sau
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-zinc-300">Phân loại cảnh</span>
        <div className="flex flex-wrap gap-1.5">
          {SHOT_CATEGORY_VALUES.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? "primary" : "ghost"}
              isDisabled={!canEdit}
              onPress={() => {
                onDispatch({ _tag: "ClassifyShot", shotId: shot.id, category: cat });
              }}
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={isFlipped ? "primary" : "ghost"}
          isDisabled={!canEdit}
          onPress={() => {
            onDispatch({ _tag: "ToggleFlip", shotId: shot.id });
          }}
        >
          <FlipHorizontal className="h-3.5 w-3.5" />
          {isFlipped ? "Đã lật ngang" : "Lật ngang"}
        </Button>
        <Button
          size="sm"
          variant={isFlipLocked ? "primary" : "ghost"}
          isDisabled={!canEdit}
          onPress={() => {
            onDispatch({ _tag: "ToggleFlipLock", shotId: shot.id });
          }}
        >
          {isFlipLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
          {isFlipLocked ? "Khoá lật" : "Cho phép lật tự động"}
        </Button>
        <Button
          size="sm"
          variant={isZoomed ? "primary" : "ghost"}
          isDisabled={!canEdit}
          onPress={() => {
            onDispatch({
              _tag: "SetZoom",
              shotId: shot.id,
              zoom: isZoomed ? { _tag: "NoZoom" } : { _tag: "AutoZoom" },
            });
          }}
        >
          <ZoomIn className="h-3.5 w-3.5" />
          {isZoomed ? "Đã bật auto zoom" : "Auto zoom"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={!canEdit}
          onPress={() => {
            onDispatch({ _tag: "DeleteShot", shotId: shot.id });
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-400" />
          Xoá cảnh
        </Button>
        <NumberInput
          label="Tốc độ"
          step={0.1}
          min={0.1}
          max={10}
          isDisabled={!canEdit}
          value={shot.edits.speed}
          onValueChange={(val) => {
            if (val >= 0.1 && val <= 10) {
              onDispatch({ _tag: "SetSpeed", shotId: shot.id, speed: val as Speed });
            }
          }}
          className="w-28"
        />
      </div>
    </div>
  );
}
