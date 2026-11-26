"use client";

import { Film, Scissors, Trash2 } from "lucide-react";

import type { ShotId } from "@/contexts/shared-kernel";
import { Button, EmptyState, IconButton, Text } from "@/shared/ui";

import type { Shot } from "../domain/types";

export interface ShotListProps {
  readonly shots: ReadonlyArray<Shot>;
  readonly selectedShotId: ShotId | null;
  readonly canEdit: boolean;
  readonly onSelect: (shotId: ShotId) => void;
  readonly onDelete: (shotId: ShotId) => void;
}

export function ShotList({ shots, selectedShotId, canEdit, onSelect, onDelete }: ShotListProps) {
  if (shots.length === 0) {
    return (
      <EmptyState
        icon={<Film className="h-8 w-8" />}
        title="Chưa có cảnh nào được tách"
        description="Tải lên video nguồn và chạy nhận diện cảnh để bắt đầu."
      />
    );
  }

  return (
    <ul className="space-y-2" aria-label="Danh sách cảnh đã tách">
      {shots.map((shot) => {
        const isSelected = shot.id === selectedShotId;
        const duration = Math.max(0, shot.range.end - shot.range.begin).toFixed(1);
        return (
          <li
            key={shot.id}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${
              isSelected
                ? "border-violet-500/60 bg-violet-500/15 text-white"
                : "border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
            }`}
          >
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                onSelect(shot.id);
              }}
              className="flex h-auto flex-1 items-center justify-start gap-2 px-1 py-0.5 text-left"
            >
              <Scissors className="h-3.5 w-3.5 shrink-0 text-violet-400" />
              <div className="min-w-0 flex-1">
                <Text variant="label" className="block truncate">
                  {shot.label}
                </Text>
                <Text variant="caption" className="block text-[11px] text-zinc-400">
                  {shot.range.begin.toFixed(1)}s – {shot.range.end.toFixed(1)}s ({duration}s) ·{" "}
                  {shot._tag === "ClassifiedShot" ? shot.category : "Chưa phân loại"}
                </Text>
              </div>
            </Button>
            {canEdit ? (
              <IconButton
                size="sm"
                variant="ghost"
                aria-label={`Xoá cảnh ${shot.label}`}
                onPress={() => {
                  onDelete(shot.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              </IconButton>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
