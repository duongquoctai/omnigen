"use client";

import { Option } from "effect";
import { Download, FolderDown, Plus } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type {
  FolderId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
  ShotId,
  SourceVideoId,
} from "@/contexts/shared-kernel";
import { usePermission, useToast } from "@/contexts/workspace";
import {
  resetSourceSession,
  sliceAndDownloadZip,
  sliceAndSaveToDirectory,
} from "@/shared/lib/slice-export-client";
import { AlertBanner, BusyModal, Button } from "@/shared/ui";

import { shotFromLegacyDto } from "../adapters/shot-dto";
import type { CategoryMinDurations, Shot, SourceVideo, Speed, TimeRange } from "../domain/types";
import { detectScenesAction } from "./actions";
import { CATEGORY_META_LIST } from "./category-meta";
import { createInitialFootageState, footageReducer } from "./footage-reducer";
import type { SceneDetectConfig } from "./scene-detect-settings";
import { SplitCategoryInspector } from "./split-category-inspector";
import { SplitInputCard } from "./split-input-card";
import { SplitVideoMonitor } from "./split-video-monitor";

export interface SplitTabProps {
  readonly sessionId: string;
  readonly folderId: FolderId;
  readonly initialShots: ReadonlyArray<Shot>;
  readonly initialSourceVideoUrl?: string | null | undefined;
  readonly initialSourceVideo?: SourceVideo | null | undefined;
  readonly initialMinDurations?: CategoryMinDurations | undefined;
  readonly maxVideoDuration: number;
}

export function SplitTab({
  sessionId,
  folderId,
  initialShots,
  initialSourceVideoUrl = null,
  initialSourceVideo = null,
  initialMinDurations,
  maxVideoDuration,
}: SplitTabProps) {
  const { can, notifyDenied } = usePermission();
  const { addToast } = useToast();
  const [selectedUrlId, setSelectedUrlId] = useQueryState("shot", parseAsString);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canEdit = can("split", "edit");

  const [state, dispatch] = useReducer(footageReducer, undefined, () =>
    createInitialFootageState(initialShots, maxVideoDuration, initialMinDurations),
  );

  const [sourceVideo, setSourceVideo] = useState<SourceVideo | null>(initialSourceVideo);
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(
    initialSourceVideoUrl ?? initialSourceVideo?.localUrl ?? null,
  );
  const [activeCategory, setActiveCategory] = useState<ShotCategory>("open");
  const [editingShotId, setEditingShotId] = useState<ShotId | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoopingShot, setIsLoopingShot] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [detectConfig, setDetectConfig] = useState<SceneDetectConfig>({
    detector: "content",
    threshold: 27,
    minSceneLen: 0.8,
  });

  const activeShotId = (selectedUrlId as ShotId | null) ?? state.selectedShotId;
  const selectedShot = state.shots.find((s) => s.id === activeShotId) ?? state.shots.at(0) ?? null;

  const seekTo = useCallback((sec: number) => {
    setCurrentTime(sec);
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
    }
  }, []);

  const selectShot = useCallback(
    (shot: Shot) => {
      dispatch({ _tag: "SelectShot", shotId: shot.id });
      void setSelectedUrlId(shot.id);
      if (shot._tag === "ClassifiedShot") {
        setActiveCategory(shot.category);
      }
      seekTo(shot.range.begin);
    },
    [seekTo, setSelectedUrlId],
  );

  const handleSelectCategory = useCallback(
    (cat: ShotCategory) => {
      setActiveCategory(cat);
      const firstInCat = state.shots.find((s) => s._tag === "ClassifiedShot" && s.category === cat);
      if (firstInCat) {
        selectShot(firstInCat);
      }
    },
    [selectShot, state.shots],
  );

  const handleSplitAtCurrent = useCallback(() => {
    if (!canEdit) {
      notifyDenied("tách cảnh");
      return;
    }
    if (!selectedShot) return;
    dispatch({
      _tag: "SplitShot",
      shotId: selectedShot.id,
      targetSec: currentTime,
      newSecondId: `shot_${String(Date.now())}` as ShotId,
    });
  }, [canEdit, currentTime, notifyDenied, selectedShot]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }

      if (e.key === " ") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) void v.play();
          else v.pause();
        }
        return;
      }

      if (!selectedShot || !canEdit) return;

      const matchedCat = CATEGORY_META_LIST.find((c) => c.hotkey === e.key);
      if (matchedCat) {
        e.preventDefault();
        dispatch({ _tag: "ClassifyShot", shotId: selectedShot.id, category: matchedCat.id });
        setActiveCategory(matchedCat.id);
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === "s") {
        e.preventDefault();
        handleSplitAtCurrent();
      } else if (lower === "m") {
        e.preventDefault();
        dispatch({ _tag: "ToggleFlip", shotId: selectedShot.id });
      } else if (lower === "l") {
        e.preventDefault();
        dispatch({ _tag: "ToggleFlipLock", shotId: selectedShot.id });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canEdit, handleSplitAtCurrent, selectedShot]);

  const handleAutoDetect = async () => {
    if (!canEdit) {
      notifyDenied("dò cảnh tự động");
      return;
    }
    setIsDetecting(true);
    const res = await detectScenesAction({
      sessionId,
      detector: detectConfig.detector,
      threshold: detectConfig.threshold,
      minSceneLen: detectConfig.minSceneLen,
      minDurations: state.minDurations,
    });
    setIsDetecting(false);
    if (res.ok) {
      const hydratedShots = res.data.shots.map(shotFromLegacyDto);
      dispatch({ _tag: "SetShots", shots: hydratedShots });
      void setSelectedUrlId(hydratedShots.at(0)?.id ?? null);
      addToast("success", `Đã dò được ${String(hydratedShots.length)} cảnh.`);
    } else {
      addToast("error", res.error);
    }
  };

  const handleAddManualShot = (category: ShotCategory) => {
    if (!canEdit) {
      notifyDenied("thêm cảnh thủ công");
      return;
    }
    const begin = Math.max(0, Math.min(state.maxVideoDuration - 1, currentTime));
    const end = Math.min(state.maxVideoDuration, Math.max(begin + 0.5, begin + 3.0));
    const newShot: Shot = {
      _tag: "ClassifiedShot",
      id: `shot_${String(Date.now())}` as ShotId,
      sourceVideoId: (sourceVideo?.id ?? sessionId) as SourceVideoId,
      label: `Cảnh thủ công #${String(state.shots.length + 1)}`,
      category,
      range: { begin: begin as Seconds, end: end as Seconds } as TimeRange,
      detectedRange: { begin: begin as Seconds, end: end as Seconds } as TimeRange,
      contentHash: Option.none(),
      edits: {
        flip: { _tag: "Unflipped", locked: false },
        speed: 1 as Speed,
        zoom: { _tag: "NoZoom" },
        crop: Option.none(),
        transition: { _tag: "NoTransition" },
      },
    };
    dispatch({ _tag: "AddManualShot", shot: newShot });
    void setSelectedUrlId(newShot.id);
    seekTo(begin);
    setEditingShotId(newShot.id);
  };

  const buildExportPayload = () => ({
    sessionId,
    filePath: sourceVideo?.localPath,
    categoryMinDurations: state.minDurations,
    shots: state.shots
      .filter((s) => s._tag === "ClassifiedShot")
      .map((s) => ({
        id: s.id,
        label: s.label,
        category: s.category,
        begin: s.range.begin,
        end: s.range.end,
        speed: s.edits.speed,
        flipH: s.edits.flip._tag === "Flipped",
        lockFlipH: s.edits.flip.locked,
      })),
  });

  const handleDownloadZip = async () => {
    if (!canEdit) {
      notifyDenied("xuất ZIP cảnh cắt");
      return;
    }
    setIsExportingZip(true);
    try {
      await sliceAndDownloadZip(buildExportPayload());
      addToast("success", "Đã tải file ZIP 5 folder cảnh cắt.");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Xuất ZIP thất bại.");
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleSaveToDir = async () => {
    if (!canEdit) {
      notifyDenied("lưu cảnh vào thư mục");
      return;
    }
    setIsSavingFolder(true);
    try {
      const res = await sliceAndSaveToDirectory(buildExportPayload());
      addToast(
        "success",
        `Đã lưu ${String(res.savedCount)} cảnh vào thư mục "${res.directoryName}".`,
      );
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Lưu thư mục thất bại.");
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleResetVideo = async () => {
    if (!canEdit) {
      notifyDenied("làm mới video nguồn");
      return;
    }
    setSourceVideo(null);
    setSourceVideoUrl(null);
    setEditingShotId(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsLoopingShot(false);
    void setSelectedUrlId(null);
    dispatch({ _tag: "ResetSession" });
    try {
      await resetSourceSession({ projectId: folderId, sessionId });
    } catch {
      // Non-fatal if session already expired
    }
    addToast("info", "Đã xóa video cũ và làm mới phiên tách video.");
  };

  const classifiedCount = state.shots.filter((s) => s._tag === "ClassifiedShot").length;
  const busyMessage = isDetecting
    ? "Đang phân tích khung hình và dò điểm chuyển cảnh bằng AI (PySceneDetect)..."
    : isExportingZip
      ? "Đang cắt cảnh bằng FFmpeg và đóng gói file ZIP 5 folder..."
      : isSavingFolder
        ? "Đang cắt cảnh và lưu trực tiếp vào thư mục máy tính..."
        : null;

  return (
    <div className="flex flex-col gap-4">
      <BusyModal isOpen={Boolean(busyMessage)} message={busyMessage} />
      {state.errorMessage ? (
        <AlertBanner status="danger" title="Lỗi tách cảnh">
          {state.errorMessage}
        </AlertBanner>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <SplitInputCard
            sessionId={sessionId}
            sourceVideo={sourceVideo}
            sourceVideoUrl={sourceVideoUrl}
            minDurations={state.minDurations}
            detectConfig={detectConfig}
            isDetecting={isDetecting}
            canEdit={canEdit}
            onVideoUploaded={(info) => {
              setSourceVideoUrl(info.localUrl);
              if (info.duration && info.duration > 0) {
                dispatch({ _tag: "SetMaxVideoDuration", maxVideoDuration: info.duration });
              }
              setSourceVideo({
                id: (sourceVideo?.id ?? `src_${String(Date.now())}`) as SourceVideoId,
                name: info.fileName,
                fileName: info.fileName,
                localUrl: info.localUrl as MediaUrl,
                localPath: (info.localPath ?? info.localUrl) as LocalPath,
                sizeBytes: info.sizeBytes,
                duration: Math.max(0.1, info.duration ?? sourceVideo?.duration ?? 1) as Seconds,
                width: Math.max(1, info.width ?? sourceVideo?.width ?? 576),
                height: Math.max(1, info.height ?? sourceVideo?.height ?? 1024),
                createdAt: sourceVideo?.createdAt ?? "",
              });
              if (info.isUploadComplete) {
                void handleAutoDetect();
              }
            }}
            onResetVideo={() => {
              void handleResetVideo();
            }}
            onMinDurationChange={(category, seconds) => {
              dispatch({ _tag: "SetMinDuration", category, seconds });
            }}
            onDetectConfigChange={setDetectConfig}
            onAutoDetect={() => {
              void handleAutoDetect();
            }}
            onError={(msg) => {
              addToast("error", msg);
            }}
          />

          <SplitCategoryInspector
            shots={state.shots}
            minDurations={state.minDurations}
            activeCategory={activeCategory}
            selectedShotId={selectedShot?.id ?? null}
            editingShotId={editingShotId}
            sourceVideoUrl={sourceVideoUrl}
            maxVideoDuration={state.maxVideoDuration}
            canEdit={canEdit}
            onSelectCategory={handleSelectCategory}
            onSelectShot={selectShot}
            onToggleEditShot={setEditingShotId}
            onAddManualShot={handleAddManualShot}
            onRenameShot={(shotId, label) => {
              dispatch({ _tag: "RenameShot", shotId, label });
            }}
            onToggleFlip={(shotId) => {
              dispatch({ _tag: "ToggleFlip", shotId });
            }}
            onToggleFlipLock={(shotId) => {
              dispatch({ _tag: "ToggleFlipLock", shotId });
            }}
            onSetSpeed={(shotId, speed) => {
              dispatch({ _tag: "SetSpeed", shotId, speed });
            }}
            onSetZoom={(shotId, zoom) => {
              dispatch({ _tag: "SetZoom", shotId, zoom });
            }}
            onClassifyShot={(shotId, category) => {
              dispatch({ _tag: "ClassifyShot", shotId, category });
              setActiveCategory(category);
            }}
            onTrimShot={(shotId, begin, end) => {
              dispatch({ _tag: "TrimShot", shotId, begin, end });
            }}
            onDeleteShot={(shotId) => {
              if (selectedUrlId === shotId) {
                void setSelectedUrlId(null);
              }
              dispatch({ _tag: "DeleteShot", shotId });
            }}
            onPlayShot={(shot) => {
              selectShot(shot);
              setIsLoopingShot(true);
              setIsPlaying(true);
              if (videoRef.current) {
                void videoRef.current.play();
              }
            }}
            onSeekPreview={seekTo}
          />
        </div>

        <div className="w-full shrink-0 lg:w-[340px]">
          <SplitVideoMonitor
            videoRef={videoRef}
            sourceVideoUrl={sourceVideoUrl}
            shots={state.shots}
            selectedShot={selectedShot}
            currentTime={currentTime}
            totalDuration={state.maxVideoDuration}
            isPlaying={isPlaying}
            isLoopingShot={isLoopingShot}
            canEdit={canEdit}
            onTimeUpdate={setCurrentTime}
            onPlayingChange={(playing) => {
              setIsPlaying(playing);
              if (!playing) {
                setIsLoopingShot(false);
              }
            }}
            onLoadedMetadata={(dur) => {
              dispatch({ _tag: "SetMaxVideoDuration", maxVideoDuration: dur });
            }}
            onToggleLoopShot={() => {
              if (isPlaying || isLoopingShot) {
                videoRef.current?.pause();
                setIsLoopingShot(false);
                setIsPlaying(false);
                return;
              }
              if (selectedShot) {
                seekTo(selectedShot.range.begin);
                setIsLoopingShot(true);
                setIsPlaying(true);
                if (videoRef.current) {
                  void videoRef.current.play();
                }
              }
            }}
            onSeekTo={seekTo}
            onSplitAtCurrent={handleSplitAtCurrent}
            onMergeNext={() => {
              if (selectedShot) {
                dispatch({ _tag: "MergeWithNext", shotId: selectedShot.id });
              }
            }}
            onSelectShot={selectShot}
            actionsFooter={
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isExportingZip}
                  isDisabled={!canEdit || classifiedCount === 0 || isSavingFolder}
                  onPress={() => {
                    void handleDownloadZip();
                  }}
                  className="flex-1 border-0 !bg-emerald-600 px-2 text-[11px] !text-white hover:!bg-emerald-500"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Toàn bộ</span>
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  isLoading={isSavingFolder}
                  isDisabled={!canEdit || classifiedCount === 0 || isExportingZip}
                  onPress={() => {
                    void handleSaveToDir();
                  }}
                  className="flex-1 border-0 !bg-emerald-600 px-2 text-[11px] !text-white hover:!bg-emerald-500"
                >
                  <FolderDown className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Lưu về máy</span>
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  isDisabled={!canEdit || isExportingZip || isSavingFolder}
                  onPress={() => {
                    void handleResetVideo();
                  }}
                  className="flex-1 border-0 !bg-indigo-600 px-2 text-[11px] !text-white hover:!bg-indigo-500"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Video tiếp theo</span>
                </Button>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
