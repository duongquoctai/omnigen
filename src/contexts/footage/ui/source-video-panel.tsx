"use client";

import { Film, Pause, Play, Repeat, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, type RefObject, useRef, useState } from "react";

import { readVideoMetadata, uploadFileInChunks } from "@/shared/lib/chunked-upload";
import { Button, Text } from "@/shared/ui";

import type { Shot } from "../domain/types";
import { IPhoneVideoTrimmer } from "./iphone-video-trimmer";

export interface SourceVideoPanelProps {
  readonly sessionId: string;
  readonly folderId: string;
  readonly sourceVideoUrl: string | null;
  readonly maxVideoDuration: number;
  readonly activeShot: Shot | null;
  readonly canEdit: boolean;
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly playingShotOnly: boolean;
  readonly onTogglePlayingShotOnly: () => void;
  readonly onPlayheadChange: (sec: number) => void;
  readonly onSourceUploaded: (result: { readonly url: string; readonly duration: number }) => void;
  readonly onTrimShot: (shotId: Shot["id"], begin: number, end: number) => void;
  readonly onNotify: (type: "info" | "success" | "error", text: string) => void;
}

export function SourceVideoPanel({
  sessionId,
  folderId,
  sourceVideoUrl,
  maxVideoDuration,
  activeShot,
  canEdit,
  videoRef,
  playingShotOnly,
  onTogglePlayingShotOnly,
  onPlayheadChange,
  onSourceUploaded,
  onTrimShot,
  onNotify,
}: SourceVideoPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleUploadFile = async (file: File) => {
    if (!canEdit) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const meta = await readVideoMetadata(file);
      const res = await uploadFileInChunks(file, {
        endpoint: "/api/upload-local",
        sessionId,
        projectId: folderId,
        kind: "source",
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        onProgress: (loaded, total) => {
          setUploadProgress(Math.min(100, Math.round((loaded / total) * 100)));
        },
      });
      if (!res.url) {
        onNotify("error", res.error ?? "Không nhận được URL video sau khi tải lên.");
        return;
      }
      onSourceUploaded({
        url: res.url,
        duration: res.duration ?? meta.duration,
      });
      onNotify("success", `Đã tải lên video nguồn "${file.name}".`);
    } catch (err) {
      onNotify("error", err instanceof Error ? err.message : "Không thể tải video nguồn.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleUploadFile(file);
    }
    e.target.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = Array.from(e.dataTransfer.files).at(0);
    if (file) {
      void handleUploadFile(file);
    }
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      if (playingShotOnly && activeShot) {
        if (el.currentTime < activeShot.range.begin || el.currentTime >= activeShot.range.end) {
          el.currentTime = activeShot.range.begin;
        }
      }
      void el.play();
    } else {
      el.pause();
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-white">
          <Film className="h-4 w-4 text-indigo-400" />
          <span>Video nguồn &amp; cắt khung thời gian</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!canEdit || isUploading}
            isLoading={isUploading}
            onPress={() => {
              fileInputRef.current?.click();
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            {sourceVideoUrl ? "Thay video nguồn" : "Tải video nguồn"}
          </Button>
        </div>
      </div>

      {isUploading ? (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-zinc-300">
            <span>Đang tải video lên máy chủ...</span>
            <span className="font-mono">{uploadProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${String(uploadProgress)}%` }}
            />
          </div>
        </div>
      ) : null}

      {sourceVideoUrl ? (
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[9/16] max-h-80 overflow-hidden rounded-xl border border-white/10 bg-black">
            <video
              ref={videoRef}
              src={sourceVideoUrl}
              playsInline
              onPlay={() => {
                setIsPlaying(true);
              }}
              onPause={() => {
                setIsPlaying(false);
              }}
              onTimeUpdate={() => {
                const el = videoRef.current;
                if (!el) return;
                onPlayheadChange(el.currentTime);
                if (playingShotOnly && activeShot && el.currentTime >= activeShot.range.end) {
                  el.currentTime = activeShot.range.begin;
                }
              }}
              className={`h-full w-full object-contain ${
                activeShot?.edits.flip._tag === "Flipped" ? "-scale-x-100" : ""
              }`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onPress={togglePlay}>
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? "Tạm dừng" : "Phát video"}
            </Button>

            <Button
              size="sm"
              variant={playingShotOnly ? "primary" : "ghost"}
              isDisabled={!activeShot}
              onPress={onTogglePlayingShotOnly}
            >
              <Repeat className="h-3.5 w-3.5" />
              {playingShotOnly ? "Đang lặp cảnh đang chọn" : "Lặp cảnh đang chọn"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => {
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center transition ${
            isDragging ? "border-indigo-400 bg-indigo-500/10" : "border-white/15 bg-black/30"
          }`}
        >
          <Upload className="h-6 w-6 text-zinc-400" />
          <Text variant="caption" className="text-zinc-300">
            Kéo thả video nguồn vào đây hoặc bấm &ldquo;Tải video nguồn&rdquo;
          </Text>
        </div>
      )}

      {activeShot ? (
        <IPhoneVideoTrimmer
          videoBegin={activeShot.range.begin}
          videoEnd={activeShot.range.end}
          totalDuration={maxVideoDuration}
          rawBegin={activeShot.detectedRange.begin}
          rawEnd={activeShot.detectedRange.end}
          disabled={!canEdit}
          onChange={(begin, end) => {
            onTrimShot(activeShot.id, begin, end);
          }}
          onSeekPreview={(targetSec) => {
            if (videoRef.current) {
              videoRef.current.currentTime = targetSec;
              onPlayheadChange(targetSec);
            }
          }}
          onScrubMove={(targetSec) => {
            if (videoRef.current) {
              videoRef.current.currentTime = targetSec;
            }
          }}
        />
      ) : null}
    </div>
  );
}
