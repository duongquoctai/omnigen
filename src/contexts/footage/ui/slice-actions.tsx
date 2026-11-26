"use client";

import { FolderPlus, Scissors, Sparkles } from "lucide-react";

import { Button } from "@/shared/ui";

export interface SliceActionsProps {
  readonly shotCount: number;
  readonly isDetecting: boolean;
  readonly isSlicing: boolean;
  readonly isPublishing: boolean;
  readonly canEdit: boolean;
  readonly canExport: boolean;
  readonly onDetect: () => void;
  readonly onSlice: () => void;
  readonly onPublish: () => void;
}

export function SliceActions({
  shotCount,
  isDetecting,
  isSlicing,
  isPublishing,
  canEdit,
  canExport,
  onDetect,
  onSlice,
  onPublish,
}: SliceActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        isLoading={isDetecting}
        isDisabled={!canEdit}
        onPress={onDetect}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Nhận diện cảnh tự động
      </Button>
      <Button
        size="sm"
        variant="secondary"
        isLoading={isSlicing}
        isDisabled={!canExport || shotCount === 0}
        onPress={onSlice}
      >
        <Scissors className="h-3.5 w-3.5" />
        Cắt các cảnh ({shotCount})
      </Button>
      <Button
        size="sm"
        variant="primary"
        isLoading={isPublishing}
        isDisabled={!canEdit || shotCount === 0}
        onPress={onPublish}
      >
        <FolderPlus className="h-3.5 w-3.5" />
        Lưu vào thư viện
      </Button>
    </div>
  );
}
