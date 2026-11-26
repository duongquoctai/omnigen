"use client";

import { Option } from "effect";
import { CheckCheck, Download } from "lucide-react";
import { useEffect, useState } from "react";

import type { FolderId, ShotCategory } from "@/contexts/shared-kernel";
import {
  pollRenderProgress,
  renderComposedBatch,
  type RenderProgressSnapshot,
  type RenderVideoPayload,
  type RenderVoicePayload,
} from "@/shared/lib/render-client";
import { BusyModal, Button, ProgressIndicator } from "@/shared/ui";

import { isSameFingerprint, type PlannedSlotEdits, tupleToKey } from "../domain/planner";
import type { Clip, ClipLibrary, PlannedVideo, VoiceClip } from "../domain/types";
import { MarkRenderedModal } from "./mark-rendered-modal";
import { PlannedVideoCard } from "./planned-video-card";
import { PreviewPlayer916 } from "./preview-player-916";

export interface PlannedVideosPanelProps {
  readonly folderId: FolderId;
  readonly videos: ReadonlyArray<PlannedVideo>;
  readonly library: ClipLibrary;
  readonly voices: ReadonlyArray<VoiceClip>;
  readonly canEdit: boolean;
  readonly canExport?: boolean | undefined;
  readonly isExpanded?: boolean | undefined;
  readonly renderedTupleKeys?: ReadonlyArray<string> | undefined;
  readonly onUpdateSlot?: (videoId: string, slotIndex: number, edits: PlannedSlotEdits) => void;
  readonly onChangeVoice?: (videoId: string, voiceId: string | null) => void;
  readonly onSwapSlotClip?: (videoId: string, slotIndex: number, nextClip: Clip) => void;
  readonly onMarkRendered?: (unrecordedVideos: ReadonlyArray<PlannedVideo>) => Promise<void> | void;
  readonly onRecordRenderedVideos?: (
    renderedVideos: ReadonlyArray<PlannedVideo>,
  ) => Promise<void> | void;
  readonly onToast: (toast: {
    readonly type: "info" | "success" | "error";
    readonly text: string;
  }) => void;
}

const findClipPath = (library: ClipLibrary, clipId: string): string | undefined => {
  for (const list of Object.values(library)) {
    const found = list.find((c) => c.id === clipId);
    if (found && found.source._tag === "LocalClip") {
      return found.source.localPath;
    }
  }
  return undefined;
};

const getVideoTupleKey = (video: PlannedVideo): string => video.tupleKey ?? tupleToKey(video.tuple);

const isTupleKeyInHistory = (tupleKey: string, historyKeys: ReadonlyArray<string>): boolean => {
  if (historyKeys.includes(tupleKey)) return true;
  const parts = tupleKey.split("|");
  if (parts.length !== 5) return false;
  return historyKeys.some((hKey) => {
    const hParts = hKey.split("|");
    if (hParts.length !== 5) return false;
    return parts.every((p, idx) => isSameFingerprint(p, hParts[idx] ?? ""));
  });
};

const toRenderVideoPayload = (
  video: PlannedVideo,
  library: ClipLibrary,
  fallbackVoiceId?: string,
): RenderVideoPayload => {
  const voiceId = Option.isSome(video.voiceId) ? video.voiceId.value : fallbackVoiceId;
  return {
    id: video.id,
    name: video.name,
    ...(voiceId ? { voiceTrackId: voiceId } : {}),
    slots: video.slots.map((s) => ({
      category: s.category,
      localPath: findClipPath(library, s.clipId),
      localUrl: s.localUrl,
      videoBegin: s.videoBegin,
      videoEnd: s.videoEnd,
      speed: s.speed,
      flipH: s.flipH,
    })),
  };
};

const toRenderVoicesPayload = (
  voices: ReadonlyArray<VoiceClip>,
): ReadonlyArray<RenderVoicePayload> =>
  voices.map((v) => ({
    id: v.id,
    localPath: v.localPath._tag === "Some" ? v.localPath.value : undefined,
    localUrl: v.localUrl,
  }));

export function PlannedVideosPanel({
  folderId,
  videos,
  library,
  voices,
  canEdit,
  canExport = true,
  isExpanded = false,
  renderedTupleKeys = [],
  onUpdateSlot,
  onChangeVoice,
  onMarkRendered,
  onRecordRenderedVideos,
  onToast,
}: PlannedVideosPanelProps) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(videos[0]?.id ?? null);
  const [editingSlotCategory, setEditingSlotCategory] = useState<ShotCategory | null>(null);
  const [activeSlotFocusIndex, setActiveSlotFocusIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<"full" | "slot">("full");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [playTrigger, setPlayTrigger] = useState(0);
  const [pauseTrigger, setPauseTrigger] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubSourceSec, setScrubSourceSec] = useState<number | null>(null);
  const [previewSeekSec, setPreviewSeekSec] = useState<number | null>(null);

  const [isRenderingBatch, setIsRenderingBatch] = useState(false);
  const [renderBusyMessage, setRenderBusyMessage] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<RenderProgressSnapshot | null>(null);
  const [showMarkAllModal, setShowMarkAllModal] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    if (!isRenderingBatch) return;
    const timer = setInterval(() => {
      void pollRenderProgress(folderId).then((snap) => {
        if (snap.active || snap.percent > 0) {
          setRenderProgress(snap);
        }
      });
    }, 700);
    return () => {
      clearInterval(timer);
    };
  }, [isRenderingBatch, folderId]);

  if (videos.length === 0) return null;

  const selectedIndex = Math.max(
    0,
    videos.findIndex((v) => v.id === selectedVideoId),
  );
  const selectedVideo = videos.at(selectedIndex) ?? videos.at(0);
  if (!selectedVideo) return null;

  const selectedVoiceId = Option.getOrNull(selectedVideo.voiceId);
  const assignedVoice = selectedVoiceId ? voices.find((v) => v.id === selectedVoiceId) : undefined;

  const unrecordedVideos = videos.filter(
    (v) => !isTupleKeyInHistory(getVideoTupleKey(v), renderedTupleKeys),
  );

  const handleRender = async (
    targetVideos: ReadonlyArray<PlannedVideo>,
    mode: "single" | "batch",
  ) => {
    setIsRenderingBatch(true);
    setRenderProgress(null);
    const singleVideo = targetVideos.at(0);
    setRenderBusyMessage(
      mode === "single" && singleVideo
        ? `Đang xuất file MP4 hoàn chỉnh cho ${singleVideo.name}...`
        : `Đang kết xuất ${String(targetVideos.length)} video MP4 và đóng gói ZIP...`,
    );
    try {
      const payloads = targetVideos.map((v) => toRenderVideoPayload(v, library));
      const res = await renderComposedBatch({
        sessionId: folderId,
        videos: payloads,
        voices: toRenderVoicesPayload(voices),
      });
      if (onRecordRenderedVideos) {
        await onRecordRenderedVideos(targetVideos);
      }
      onToast({
        type: "success",
        text:
          mode === "batch"
            ? `Đã render thành công toàn bộ ${String(targetVideos.length)} video MP4 chuẩn và tải về ZIP!`
            : `Đã xuất xong "${res.fileName}".`,
      });
    } catch (err) {
      onToast({
        type: "error",
        text: err instanceof Error ? err.message : "Lỗi khi render video.",
      });
    } finally {
      setIsRenderingBatch(false);
      setRenderBusyMessage(null);
      setRenderProgress(null);
    }
  };

  const handleConfirmMarkAll = async () => {
    if (unrecordedVideos.length === 0) {
      setShowMarkAllModal(false);
      return;
    }
    setIsMarkingAll(true);
    try {
      if (onMarkRendered) {
        await onMarkRendered(unrecordedVideos);
      }
      setShowMarkAllModal(false);
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      <BusyModal
        isOpen={Boolean(renderBusyMessage)}
        message={
          renderProgress && renderProgress.total > 0
            ? `${renderBusyMessage ?? ""} (${String(renderProgress.current)}/${String(renderProgress.total)} - ${String(Math.round(renderProgress.percent))}%)`
            : renderBusyMessage
        }
      />

      <div className="flex flex-col items-stretch gap-6 lg:flex-row">
        {/* Left Column: Combinations List (full height & width inside card) */}
        <section
          className={`flex w-full min-w-0 flex-1 flex-col rounded-2xl border border-zinc-800/90 bg-[#0b0d18] p-3 transition-all duration-300 ${
            isExpanded ? "lg:h-[calc(100vh-148px)] lg:min-h-[692px]" : "lg:h-[692px]"
          }`}
        >
          {isRenderingBatch && renderProgress ? (
            <div className="mb-3 shrink-0 space-y-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-200">
              <ProgressIndicator
                label={`Đang render ${String(renderProgress.current)}/${String(renderProgress.total)}: ${renderProgress.current_name}`}
                value={renderProgress.percent}
                size="sm"
              />
            </div>
          ) : null}

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {videos.map((video, idx) => {
              const isSelected = selectedVideo.id === video.id;
              const isCardPlaying = isSelected && isPreviewPlaying && previewMode === "full";
              const isRendered = isTupleKeyInHistory(getVideoTupleKey(video), renderedTupleKeys);

              return (
                <PlannedVideoCard
                  key={video.id}
                  video={video}
                  index={idx}
                  isSelected={isSelected}
                  isDimmed={editingSlotCategory !== null && !isSelected && videos.length > 1}
                  isRendered={isRendered}
                  isCardPlaying={isCardPlaying}
                  editingSlotCategory={isSelected ? editingSlotCategory : null}
                  voices={voices}
                  canEdit={canEdit}
                  canExport={canExport}
                  isRenderingBatch={isRenderingBatch}
                  onSelectVideo={(vid) => {
                    setSelectedVideoId(vid);
                  }}
                  onTogglePlayFull={(vid, currentlyPlaying) => {
                    if (currentlyPlaying) {
                      setPauseTrigger((p) => p + 1);
                    } else {
                      setSelectedVideoId(vid);
                      setEditingSlotCategory(null);
                      setActiveSlotFocusIndex(null);
                      setPreviewMode("full");
                      setPlayTrigger((p) => p + 1);
                    }
                  }}
                  onRenderSingle={(v) => {
                    void handleRender([v], "single");
                  }}
                  onToggleSlotCategory={(vid, category, sIdx) => {
                    const isSameVideo = selectedVideo.id === vid;
                    const isCurrentlyActive = isSameVideo && editingSlotCategory === category;
                    setSelectedVideoId(vid);
                    const willBeActive = !isCurrentlyActive;
                    setEditingSlotCategory(willBeActive ? category : null);
                    setActiveSlotFocusIndex(willBeActive ? sIdx : null);
                    setPreviewMode(willBeActive ? "slot" : "full");
                  }}
                  onCloseSlotInspector={() => {
                    setEditingSlotCategory(null);
                    setActiveSlotFocusIndex(null);
                    setPreviewMode("full");
                  }}
                  onChangeVoice={(vid, voiceId) => {
                    onChangeVoice?.(vid, voiceId);
                  }}
                  onUpdateSlot={(vid, sIdx, edits) => {
                    onUpdateSlot?.(vid, sIdx, edits);
                  }}
                  onPreviewSlot={(vid, sIdx) => {
                    setSelectedVideoId(vid);
                    setPreviewMode("slot");
                    setActiveSlotFocusIndex(sIdx);
                    setPlayTrigger((p) => p + 1);
                  }}
                  onScrubStart={(vid, sIdx) => {
                    setSelectedVideoId(vid);
                    setIsScrubbing(true);
                    setPreviewMode("slot");
                    setActiveSlotFocusIndex(sIdx);
                  }}
                  onScrubMove={(sourceSec) => {
                    setScrubSourceSec(sourceSec);
                  }}
                  onScrubEnd={() => {
                    setIsScrubbing(false);
                  }}
                  onSeekPreview={(vid, sIdx, targetSec) => {
                    setSelectedVideoId(vid);
                    setActiveSlotFocusIndex(sIdx);
                    const slot = video.slots.at(sIdx);
                    if (slot) {
                      const timelinePos =
                        slot.enterBegin + (targetSec - slot.videoBegin) / (slot.speed || 1);
                      setPreviewSeekSec(timelinePos);
                    }
                  }}
                />
              );
            })}
          </div>
        </section>

        {/* Right Column: Full 9:16 Preview + Download All Button (total height = 692px) */}
        <div className="flex w-full shrink-0 flex-col items-center gap-3 lg:h-[692px] lg:w-[360px]">
          <div className="flex w-full flex-1 items-center justify-center">
            <PreviewPlayer916
              video={selectedVideo}
              voiceUrl={assignedVoice?.localUrl ?? null}
              voiceDuration={assignedVoice?.duration}
              enableVoice={Boolean(assignedVoice)}
              previewMode={previewMode}
              isolatedSlotIndex={
                previewMode === "slot" && typeof activeSlotFocusIndex === "number"
                  ? activeSlotFocusIndex
                  : null
              }
              isScrubbing={isScrubbing}
              scrubSourceSec={scrubSourceSec}
              playTrigger={playTrigger}
              pauseTrigger={pauseTrigger}
              seekTimelineSec={previewSeekSec}
              onPlayingChange={setIsPreviewPlaying}
            />
          </div>

          {canExport || canEdit ? (
            <div className="flex w-full shrink-0 items-center gap-2.5">
              {canExport ? (
                <Button
                  fullWidth
                  size="md"
                  variant="primary"
                  isLoading={isRenderingBatch}
                  isDisabled={isRenderingBatch}
                  onPress={() => {
                    void handleRender(videos, "batch");
                  }}
                  className="h-10 flex-1 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
                >
                  {!isRenderingBatch ? <Download className="h-4 w-4" /> : null}
                  Toàn bộ ({videos.length} MP4)
                </Button>
              ) : null}

              {canEdit ? (
                <Button
                  fullWidth
                  size="md"
                  variant="ghost"
                  isDisabled={isRenderingBatch || isMarkingAll}
                  onPress={() => {
                    setShowMarkAllModal(true);
                  }}
                  className="h-10 flex-1 rounded-xl border border-emerald-500/60 !bg-emerald-600 text-xs font-bold !text-white shadow-lg shadow-emerald-600/20 hover:!bg-emerald-500"
                >
                  <CheckCheck className="h-4 w-4" />
                  Đánh dấu đã render
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <MarkRenderedModal
        isOpen={showMarkAllModal}
        onOpenChange={setShowMarkAllModal}
        totalVideosCount={videos.length}
        unrecordedCount={unrecordedVideos.length}
        isSubmitting={isMarkingAll}
        onConfirm={() => {
          void handleConfirmMarkAll();
        }}
      />
    </div>
  );
}
