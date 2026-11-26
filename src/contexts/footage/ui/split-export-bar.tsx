"use client";

import { Download, FolderDown, Plus } from "lucide-react";

import { Button, StudioCard, Text } from "@/shared/ui";

export interface SplitExportBarProps {
  readonly classifiedCount: number;
  readonly isExportingZip: boolean;
  readonly isSavingFolder: boolean;
  readonly canEdit: boolean;
  readonly onDownloadZip: () => void;
  readonly onSaveToDirectory: () => void;
  readonly onResetNextVideo: () => void;
}

export function SplitExportBar({
  classifiedCount,
  isExportingZip,
  isSavingFolder,
  canEdit,
  onDownloadZip,
  onSaveToDirectory,
  onResetNextVideo,
}: SplitExportBarProps) {
  const hasClassified = classifiedCount > 0;

  return (
    <StudioCard className="border-zinc-800/90 bg-[#0b0d18]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Text variant="label" className="block text-sm font-semibold text-white">
            Xuất toàn bộ các cảnh đã tinh chỉnh về máy tính
          </Text>
          <Text variant="caption" className="mt-0.5 block text-zinc-400">
            Cắt siêu tốc bằng FFmpeg, giữ nguyên chất lượng 100%, bảo toàn mốc giây và mirror đã
            chỉnh
          </Text>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            size="md"
            variant="primary"
            isLoading={isExportingZip}
            isDisabled={!canEdit || !hasClassified || isSavingFolder}
            onPress={onDownloadZip}
            className="border-0 !bg-emerald-600 !text-white hover:!bg-emerald-500"
          >
            <Download className="h-4 w-4" />
            Toàn bộ
          </Button>

          <Button
            size="md"
            variant="primary"
            isLoading={isSavingFolder}
            isDisabled={!canEdit || !hasClassified || isExportingZip}
            onPress={onSaveToDirectory}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <FolderDown className="h-4 w-4" />
            Lưu về máy
          </Button>

          <Button
            size="md"
            variant="primary"
            isDisabled={!canEdit || isExportingZip || isSavingFolder}
            onPress={onResetNextVideo}
            className="bg-indigo-600 text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Video tiếp theo
          </Button>
        </div>
      </div>
    </StudioCard>
  );
}
