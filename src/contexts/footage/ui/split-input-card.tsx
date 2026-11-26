"use client";

import { RefreshCw, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";

import type { ShotCategory } from "@/contexts/shared-kernel";
import { uploadFileInChunks } from "@/shared/lib/chunked-upload";
import {
  Button,
  NumberInput,
  ProgressIndicator,
  SelectField,
  StatusChip,
  StudioCard,
  SurfaceBox,
  Text,
} from "@/shared/ui";

import type { CategoryMinDurations, SourceVideo } from "../domain/types";
import { CATEGORY_META_LIST } from "./category-meta";
import type { SceneDetectConfig } from "./scene-detect-settings";

export interface SplitInputCardProps {
  readonly sessionId: string;
  readonly sourceVideo: SourceVideo | null;
  readonly sourceVideoUrl: string | null;
  readonly minDurations: CategoryMinDurations;
  readonly detectConfig: SceneDetectConfig;
  readonly isDetecting: boolean;
  readonly canEdit: boolean;
  readonly onVideoUploaded: (info: {
    readonly localUrl: string;
    readonly localPath?: string | undefined;
    readonly fileName: string;
    readonly duration?: number | undefined;
    readonly width?: number | undefined;
    readonly height?: number | undefined;
    readonly sizeBytes: number;
    readonly isUploadComplete?: boolean | undefined;
  }) => void;
  readonly onResetVideo: () => void;
  readonly onMinDurationChange: (category: ShotCategory, seconds: number) => void;
  readonly onDetectConfigChange: (config: SceneDetectConfig) => void;
  readonly onAutoDetect: () => void;
  readonly onError: (message: string) => void;
}

export function SplitInputCard({
  sessionId,
  sourceVideo,
  sourceVideoUrl,
  minDurations,
  detectConfig,
  isDetecting,
  canEdit,
  onVideoUploaded,
  onResetVideo,
  onMinDurationChange,
  onDetectConfigChange,
  onAutoDetect,
  onError,
}: SplitInputCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [localSizeBytes, setLocalSizeBytes] = useState<number>(0);

  const handleFileSelected = async (file: File) => {
    setLocalFileName(file.name);
    setLocalSizeBytes(file.size);
    setUploadProgress(0);

    const blobUrl = URL.createObjectURL(file);
    onVideoUploaded({
      localUrl: blobUrl,
      fileName: file.name,
      sizeBytes: file.size,
      isUploadComplete: false,
    });

    try {
      const result = await uploadFileInChunks(file, {
        sessionId,
        kind: "source",
        onProgress: (loaded, total) => {
          setUploadProgress(Math.round((loaded / Math.max(1, total)) * 100));
        },
      });
      onVideoUploaded({
        localUrl: result.url ?? blobUrl,
        localPath: result.localPath,
        fileName: result.fileName || file.name,
        duration: result.duration,
        width: result.width,
        height: result.height,
        sizeBytes: file.size,
        isUploadComplete: true,
      });
      setUploadProgress(null);
    } catch (err) {
      setUploadProgress(null);
      onError(err instanceof Error ? err.message : "Upload video thất bại.");
    }
  };

  const isUploading = uploadProgress !== null;
  const displayName = sourceVideo?.fileName ?? (isUploading ? localFileName : null);
  const displayDuration = sourceVideo?.duration ?? 0;
  const displayWidth = sourceVideo?.width ?? 0;
  const displayHeight = sourceVideo?.height ?? 0;
  const displayMb = (
    (sourceVideo?.sizeBytes ?? (isUploading ? localSizeBytes : 0)) /
    (1024 * 1024)
  ).toFixed(1);
  const hasVideo = Boolean(sourceVideoUrl || sourceVideo || isUploading);

  return (
    <StudioCard className="border-zinc-800/90 bg-[#0b0d18]">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusChip color="accent" variant="soft" size="sm">
                1
              </StatusChip>
              <Text variant="label" className="text-sm font-semibold text-white">
                Upload 1 video gốc để tách
              </Text>
            </div>
            {hasVideo ? (
              <Button
                size="sm"
                variant="tertiary"
                isDisabled={!canEdit}
                onPress={() => {
                  setLocalFileName(null);
                  setLocalSizeBytes(0);
                  setUploadProgress(null);
                  onResetVideo();
                }}
                className="border-0 bg-zinc-800/70 text-zinc-200 hover:bg-zinc-700/80"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Làm video mới
              </Button>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            aria-label="Chọn video gốc để tách"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleFileSelected(file);
              }
              e.target.value = "";
            }}
          />

          {hasVideo ? (
            <SurfaceBox className="flex flex-col gap-2.5 border-zinc-800 bg-[#070811] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Text variant="label" className="block truncate text-sm font-semibold text-white">
                    {displayName ?? "Video gốc"}
                  </Text>
                  <Text variant="caption" className="mt-0.5 block text-zinc-400">
                    {displayMb} MB
                    {displayWidth > 0 && displayHeight > 0
                      ? ` • ${String(displayWidth)}x${String(displayHeight)}`
                      : ""}
                  </Text>
                </div>
                {displayDuration > 0 ? (
                  <Text variant="mono" className="shrink-0 text-sm font-semibold text-emerald-400">
                    {displayDuration.toFixed(1)}s
                  </Text>
                ) : null}
              </div>
              {uploadProgress !== null ? (
                <ProgressIndicator
                  label="Đang tải video lên máy chủ..."
                  value={uploadProgress}
                  size="sm"
                />
              ) : null}
            </SurfaceBox>
          ) : (
            <SurfaceBox className="flex flex-col items-center justify-center gap-2 border-dashed border-zinc-700 bg-[#070811] p-5 text-center">
              <Text variant="caption" className="text-zinc-400">
                Chọn file video MP4 / MOV để tự động cắt thành 5 nhóm cảnh
              </Text>
              <Button
                size="sm"
                variant="primary"
                isDisabled={!canEdit}
                onPress={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Chọn video gốc
              </Button>
            </SurfaceBox>
          )}
        </div>

        <div className="flex flex-col justify-between gap-3 lg:col-span-7">
          <div className="flex items-center gap-2">
            <StatusChip color="accent" variant="soft" size="sm">
              2
            </StatusChip>
            <Text variant="label" className="text-sm font-semibold text-white">
              Cài đặt số giây tối thiểu (min giây) cho 5 category
            </Text>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CATEGORY_META_LIST.map((cat) => (
              <SurfaceBox
                key={cat.id}
                className="flex flex-col gap-1.5 border-zinc-800 bg-[#070811] p-2"
              >
                <StatusChip
                  color={cat.chipColor}
                  variant="soft"
                  size="sm"
                  className="w-full justify-center"
                >
                  {cat.numberLabel}
                </StatusChip>
                <NumberInput
                  ariaLabel={`Số giây tối thiểu ${cat.numberLabel}`}
                  value={minDurations[cat.id]}
                  onValueChange={(val) => {
                    onMinDurationChange(cat.id, val);
                  }}
                  min={0.5}
                  max={60}
                  step={0.1}
                  showSteppers={false}
                />
              </SurfaceBox>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Text variant="caption" className="text-zinc-400">
                  Thuật toán:
                </Text>
                <SelectField
                  ariaLabel="Thuật toán dò cảnh"
                  value={detectConfig.detector}
                  onValueChange={(val) => {
                    onDetectConfigChange({
                      ...detectConfig,
                      detector: val === "adaptive" ? "adaptive" : "content",
                    });
                  }}
                  options={[
                    { value: "content", label: "Content" },
                    { value: "adaptive", label: "Adaptive" },
                  ]}
                  className="w-32"
                />
              </div>

              <div className="flex items-center gap-2">
                <Text variant="caption" className="text-zinc-400">
                  Threshold:
                </Text>
                <NumberInput
                  ariaLabel="Ngưỡng Threshold"
                  value={detectConfig.threshold}
                  onValueChange={(val) => {
                    onDetectConfigChange({
                      ...detectConfig,
                      threshold: val,
                    });
                  }}
                  min={1}
                  max={100}
                  step={1}
                  showSteppers={false}
                  className="w-20"
                />
              </div>
            </div>

            <Button
              size="sm"
              variant="primary"
              isLoading={isDetecting}
              isDisabled={!canEdit || !sourceVideoUrl}
              onPress={onAutoDetect}
              className="bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isDetecting ? "Đang dò cảnh..." : "Auto detect"}
            </Button>
          </div>
        </div>
      </div>
    </StudioCard>
  );
}
