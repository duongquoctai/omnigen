"use client";

import { Option } from "effect";
import { Clock, Edit3, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  type ClipId,
  type FolderId,
  type Seconds,
  SHOT_CATEGORY_VALUES,
  type ShotCategory,
  type VoiceId,
} from "@/contexts/shared-kernel";
import { BusyModal, Button, Modal, NumberInput, Text, TextInput } from "@/shared/ui";

import { type PlannedSlotEdits, recalculatePlannedVideo, tupleToKey } from "../domain/planner";
import type { Clip, ClipLibrary, PlannedVideo, VoiceClip } from "../domain/types";
import {
  clearCategoryAction,
  ingestDriveLinksAction,
  ingestDriveVoicesAction,
  planMixAction,
  removeClipAction,
  removeVoiceAction,
} from "./actions";
import { ClipLibraryBoard, type ImportSummaryCounts } from "./clip-library-board";
import type { DiversityRulesFormOutput } from "./diversity-rules-form";
import { type DriveDrawerTab, DriveHistoryDrawer } from "./drive-history-drawer";
import { PlannedVideosPanel } from "./planned-videos-panel";
import { getStoredPlannedVideos, setStoredPlannedVideos } from "./planned-videos-store";
import { uploadCategoryFiles, uploadMasterFolderFiles, uploadVoiceFiles } from "./upload-helpers";

export interface MixTabProps {
  readonly folderId: FolderId;
  readonly defaultClipPrefix?: string | undefined;
  readonly initialLibrary: ClipLibrary;
  readonly initialVoices: ReadonlyArray<VoiceClip>;
  readonly canEdit: boolean;
  readonly canExport?: boolean | undefined;
  readonly renderedTupleKeys?: ReadonlyArray<string> | undefined;
  readonly onRecordRenderedBatch?: (
    entries: ReadonlyArray<{
      readonly tupleKey: string;
      readonly name: string;
      readonly payload?: unknown;
    }>,
  ) => Promise<void> | void;
  readonly onToast: (toast: {
    readonly type: "info" | "success" | "error";
    readonly text: string;
  }) => void;
}

const mergeById = <T extends { readonly id: string }>(
  prev: ReadonlyArray<T>,
  incoming: ReadonlyArray<T>,
): ReadonlyArray<T> => {
  const dedupedIncoming = Array.from(new Map(incoming.map((item) => [item.id, item])).values());
  const incomingIds = new Set(dedupedIncoming.map((item) => item.id));
  return [...prev.filter((item) => !incomingIds.has(item.id)), ...dedupedIncoming];
};

export function MixTab({
  folderId,
  defaultClipPrefix = "",
  initialLibrary,
  initialVoices,
  canEdit,
  canExport = true,
  renderedTupleKeys = [],
  onRecordRenderedBatch,
  onToast,
}: MixTabProps) {
  const [library, setLibrary] = useState<ClipLibrary>(initialLibrary);
  const [voices, setVoices] = useState<ReadonlyArray<VoiceClip>>(initialVoices);
  const [mixVoiceMode, setMixVoiceMode] = useState<"rotate" | "none">("rotate");
  const [clipNamePrefix, setClipNamePrefix] = useState(defaultClipPrefix);
  const [targetMixCount, setTargetMixCount] = useState(10);
  const [plannedVideos, setPlannedVideosState] = useState<ReadonlyArray<PlannedVideo>>(() =>
    getStoredPlannedVideos(folderId),
  );
  const setPlannedVideos = (
    next:
      | ReadonlyArray<PlannedVideo>
      | ((prev: ReadonlyArray<PlannedVideo>) => ReadonlyArray<PlannedVideo>),
  ) => {
    setPlannedVideosState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      setStoredPlannedVideos(folderId, resolved);
      return resolved;
    });
  };
  const [localRenderedKeys, setLocalRenderedKeys] =
    useState<ReadonlyArray<string>>(renderedTupleKeys);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);
  const [isUploadingVoices, setIsUploadingVoices] = useState(false);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<Clip | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [drawerTab, setDrawerTab] = useState<DriveDrawerTab>("processing");
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const [lastImportSummary, setLastImportSummary] = useState<ImportSummaryCounts | null>(null);
  const didAutoMixRef = useRef(false);

  useEffect(() => {
    if (didAutoMixRef.current) return;
    const hasAllFiveCategories =
      initialLibrary.open.length > 0 &&
      initialLibrary.product.length > 0 &&
      initialLibrary.texture.length > 0 &&
      initialLibrary.apply.length > 0 &&
      initialLibrary.end.length > 0;
    if (!hasAllFiveCategories || getStoredPlannedVideos(folderId).length > 0) {
      return;
    }
    didAutoMixRef.current = true;
    let cancelled = false;
    void planMixAction({
      folderId,
      syncMode: "video_master",
      rules: {
        targetCount: 10,
        targetOutputDuration: 20,
        minHammingDistance: 2,
        maxShotFrequency: Math.max(2, Math.ceil(10 / 3)),
        seed: Date.now(),
        enableAutoVariantEdits: false,
        randomTransitionDuration: 0 as Seconds,
      },
      enableVoice: true,
      clipNamePrefix: defaultClipPrefix.trim(),
      preserveOriginalClips: true,
    }).then((res) => {
      if (cancelled || !res.ok) return;
      const hydratedVideos: ReadonlyArray<PlannedVideo> = res.data.videos.map((v) => ({
        ...v,
        voiceId: v.voiceId ? Option.some(v.voiceId) : Option.none(),
      }));
      setStoredPlannedVideos(folderId, hydratedVideos);
      setPlannedVideosState(hydratedVideos);
    });
    return () => {
      cancelled = true;
    };
  }, [defaultClipPrefix, folderId, initialLibrary]);

  const totalLibraryItems =
    library.open.length +
    library.product.length +
    library.texture.length +
    library.apply.length +
    library.end.length +
    voices.length;

  const effectiveRenderedKeys =
    renderedTupleKeys.length >= localRenderedKeys.length ? renderedTupleKeys : localRenderedKeys;

  const handleIngestCategory = async (category: ShotCategory, urls: ReadonlyArray<string>) => {
    setBusyMessage(`Đang nạp ${String(urls.length)} link Drive vào ${category.toUpperCase()}...`);
    const res = await ingestDriveLinksAction({ folderId, category, urls });
    setBusyMessage(null);
    if (!res.ok) {
      onToast({ type: "error", text: res.error });
      return;
    }
    const hydratedClips: ReadonlyArray<Clip> = res.data.clips.map((c) => ({
      ...c,
      contentHash: c.contentHash ? Option.some(c.contentHash) : Option.none(),
    }));
    setLibrary((prev) => ({
      ...prev,
      [category]: mergeById(prev[category], hydratedClips),
    }));
    onToast({
      type: "success",
      text: `Đã thêm ${String(res.data.addedCount)} clip vào nhóm ${category}.`,
    });
  };

  const handleIngestVoices = async (urls: ReadonlyArray<string>) => {
    setBusyMessage(`Đang nạp ${String(urls.length)} file voice từ Drive...`);
    const res = await ingestDriveVoicesAction({ folderId, urls });
    setBusyMessage(null);
    if (!res.ok) {
      onToast({ type: "error", text: res.error });
      return;
    }
    const hydratedVoices: ReadonlyArray<VoiceClip> = res.data.voices.map((v) => ({
      ...v,
      localPath: v.localPath ? Option.some(v.localPath) : Option.none(),
    }));
    setVoices((prev) => mergeById(prev, hydratedVoices));
    onToast({
      type: "success",
      text: `Đã thêm ${String(res.data.addedCount)} voice.`,
    });
  };

  const handleUploadCategoryFiles = async (category: ShotCategory, files: FileList) => {
    try {
      const added = await uploadCategoryFiles({
        folderId,
        category,
        files,
        onProgressText: setUploadProgressText,
      });
      setUploadProgressText(null);
      if (added.length > 0) {
        setLibrary((prev) => ({ ...prev, [category]: [...prev[category], ...added] }));
        onToast({
          type: "success",
          text: `Đã tải lên ${String(added.length)} clip vào ${category}.`,
        });
      }
    } catch (err) {
      setUploadProgressText(null);
      onToast({
        type: "error",
        text: err instanceof Error ? err.message : "Upload clip thất bại.",
      });
    }
  };

  const handleUploadVoices = async (files: FileList) => {
    setIsUploadingVoices(true);
    try {
      const added = await uploadVoiceFiles({ folderId, files });
      if (added.length > 0) {
        setVoices((prev) => [...prev, ...added]);
        onToast({ type: "success", text: `Đã tải lên ${String(added.length)} file voice.` });
      }
    } catch (err) {
      onToast({
        type: "error",
        text: err instanceof Error ? err.message : "Upload voice thất bại.",
      });
    } finally {
      setIsUploadingVoices(false);
    }
  };

  const handleUploadMasterFolder = async (files: FileList) => {
    setBusyMessage("Đang quét thư mục tổng và phân loại 5 category + Voice...");
    try {
      const result = await uploadMasterFolderFiles({
        folderId,
        files,
        onProgressText: setBusyMessage,
      });
      let totalAdded = 0;
      setLibrary((prev) => {
        const next = { ...prev };
        for (const cat of SHOT_CATEGORY_VALUES) {
          if (result.clipsByCategory[cat].length > 0) {
            next[cat] = [...prev[cat], ...result.clipsByCategory[cat]];
            totalAdded += result.clipsByCategory[cat].length;
          }
        }
        return next;
      });
      if (result.voices.length > 0) {
        setVoices((prev) => [...prev, ...result.voices]);
        totalAdded += result.voices.length;
      }
      onToast({
        type: totalAdded > 0 ? "success" : "info",
        text:
          totalAdded > 0
            ? `Đã tải lên ${String(totalAdded)} file từ thư mục tổng.`
            : "Không tìm thấy thư mục Open/Product/Texture/Apply/End/Voice hợp lệ.",
      });
    } catch (err) {
      onToast({
        type: "error",
        text: err instanceof Error ? err.message : "Upload thư mục tổng thất bại.",
      });
    } finally {
      setBusyMessage(null);
    }
  };

  const handleRemoveClip = async (clipId: string) => {
    const res = await removeClipAction({ folderId, clipId: clipId as ClipId });
    if (!res.ok) {
      onToast({ type: "error", text: res.error });
      return;
    }
    setLibrary((prev) => ({
      open: prev.open.filter((c) => c.id !== clipId),
      product: prev.product.filter((c) => c.id !== clipId),
      texture: prev.texture.filter((c) => c.id !== clipId),
      apply: prev.apply.filter((c) => c.id !== clipId),
      end: prev.end.filter((c) => c.id !== clipId),
    }));
  };

  const handleRemoveVoice = async (voiceId: string) => {
    const res = await removeVoiceAction({ folderId, voiceId: voiceId as VoiceId });
    if (!res.ok) {
      onToast({ type: "error", text: res.error });
      return;
    }
    setVoices((prev) => prev.filter((v) => v.id !== voiceId));
  };

  const handleClearCategory = async (category: ShotCategory) => {
    const res = await clearCategoryAction({ folderId, category });
    if (!res.ok) {
      onToast({ type: "error", text: res.error });
      return;
    }
    setLibrary((prev) => ({ ...prev, [category]: [] }));
  };

  const handleClearAllCategories = async () => {
    setBusyMessage("Đang xoá toàn bộ kho clip, voice và danh sách tổ hợp...");
    try {
      for (const cat of SHOT_CATEGORY_VALUES) {
        if (library[cat].length > 0) {
          await clearCategoryAction({ folderId, category: cat });
        }
      }
      for (const v of voices) {
        await removeVoiceAction({ folderId, voiceId: v.id });
      }
      setLibrary({ open: [], product: [], texture: [], apply: [], end: [] });
      setVoices([]);
      setPlannedVideos([]);
      setLastImportSummary(null);
      onToast({
        type: "success",
        text: "Đã xoá toàn bộ clip trong kho, voice và danh sách tổ hợp.",
      });
    } finally {
      setBusyMessage(null);
    }
  };

  const handleToggleLockFlip = (clipId: string) => {
    const toggle = (list: ReadonlyArray<Clip>): ReadonlyArray<Clip> =>
      list.map((c) => (c.id === clipId ? { ...c, lockFlipH: !c.lockFlipH } : c));
    setLibrary((prev) => ({
      open: toggle(prev.open),
      product: toggle(prev.product),
      texture: toggle(prev.texture),
      apply: toggle(prev.apply),
      end: toggle(prev.end),
    }));
  };

  const handlePlanMix = async (rules: DiversityRulesFormOutput) => {
    setBusyMessage("Đang tính toán các tổ hợp đa dạng tối ưu (Hamming distance, Speed Scale)...");
    try {
      const res = await planMixAction({
        folderId,
        syncMode: "video_master",
        rules: {
          ...rules,
          enableAutoVariantEdits: false,
          randomTransitionDuration: 0 as Seconds,
        },
        enableVoice: mixVoiceMode !== "none",
        clipNamePrefix: (clipNamePrefix || defaultClipPrefix).trim(),
        preserveOriginalClips: true,
      });
      if (!res.ok) {
        onToast({ type: "error", text: res.error });
        return res;
      }
      const hydratedVideos: ReadonlyArray<PlannedVideo> = res.data.videos.map((v) => ({
        ...v,
        voiceId: v.voiceId ? Option.some(v.voiceId) : Option.none(),
      }));
      setPlannedVideos(hydratedVideos);
      onToast({
        type: "success",
        text: `Đã tạo ${String(res.data.videos.length)} tổ hợp video mới.`,
      });
      return res;
    } finally {
      setBusyMessage(null);
    }
  };

  const handleUpdateSlot = (videoId: string, slotIndex: number, edits: PlannedSlotEdits) => {
    setPlannedVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? recalculatePlannedVideo({ video: v, slotIndex, edits }) : v,
      ),
    );
  };

  const handleChangeVoice = (videoId: string, voiceId: string | null) => {
    const nextVoiceId: Option.Option<VoiceId> = voiceId
      ? Option.some(voiceId as VoiceId)
      : Option.none();
    setPlannedVideos((prev) =>
      prev.map((v) =>
        v.id === videoId
          ? recalculatePlannedVideo({ video: v, slotIndex: -1, edits: {}, nextVoiceId })
          : v,
      ),
    );
  };

  const handleRecordVideosToHistory = async (
    targetVideos: ReadonlyArray<PlannedVideo>,
    notifySuccess: boolean,
  ) => {
    const entries = targetVideos.map((v) => {
      const resolvedVoiceId = Option.getOrNull(v.voiceId);
      const matchedVoice = resolvedVoiceId
        ? voices.find((voice) => voice.id === resolvedVoiceId)
        : undefined;
      return {
        tupleKey: v.tupleKey ?? tupleToKey(v.tuple),
        name: v.name,
        payload: {
          ...v,
          voiceId: resolvedVoiceId,
          ...(resolvedVoiceId ? { voiceTrackId: resolvedVoiceId } : {}),
          ...(matchedVoice ? { voiceName: matchedVoice.name } : {}),
        },
      };
    });
    const newKeys = entries.map((e) => e.tupleKey);
    setLocalRenderedKeys((prev) => Array.from(new Set([...prev, ...newKeys])));
    if (onRecordRenderedBatch) {
      await onRecordRenderedBatch(entries);
    }
    if (notifySuccess) {
      onToast({
        type: "success",
        text: `Đã đánh dấu thành công ${String(targetVideos.length)} video vào lịch sử render!`,
      });
    }
  };

  return (
    <div className="space-y-5">
      <BusyModal isOpen={Boolean(busyMessage)} message={busyMessage} />

      <ClipLibraryBoard
        library={library}
        voices={voices}
        canEdit={canEdit}
        uploadProgressText={uploadProgressText}
        lastImportSummary={lastImportSummary}
        isClearAllOpen={isClearAllOpen}
        onClearAllOpenChange={setIsClearAllOpen}
        isCollapsed={isLibraryCollapsed}
        onCollapsedChange={setIsLibraryCollapsed}
        onIngestCategory={handleIngestCategory}
        onIngestVoices={handleIngestVoices}
        onImportBatchComplete={setLastImportSummary}
        onUploadMasterFolder={handleUploadMasterFolder}
        onClearAllCategories={handleClearAllCategories}
        onOpenDriveHistory={(q, tab) => {
          setHistorySearch(q ?? "");
          setDrawerTab(tab ?? "processed");
          setHistoryDrawerOpen(true);
        }}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-indigo-400" />
              <Text variant="label" className="font-bold whitespace-nowrap text-white">
                Tên clip:
              </Text>
              <TextInput
                aria-label="Tên clip"
                value={clipNamePrefix}
                onChange={(e) => {
                  setClipNamePrefix(e.target.value);
                }}
                placeholder={defaultClipPrefix || "Ví dụ: Serum_T11"}
                disabled={!canEdit}
                className="w-48"
              />
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-rose-400" />
              <Text variant="label" className="font-bold whitespace-nowrap text-white">
                Số video muốn tạo:
              </Text>
              <NumberInput
                ariaLabel="Số video muốn tạo"
                value={targetMixCount}
                onValueChange={(val) => {
                  setTargetMixCount(Math.max(1, Math.min(50, Math.round(val))));
                }}
                min={1}
                max={50}
                step={1}
                isDisabled={!canEdit}
                showSteppers={false}
                className="w-20"
              />
              <Text variant="caption" className="hidden text-[11px] text-zinc-400 xl:inline">
                video (Tối đa 50)
              </Text>
            </div>

            <div className="flex items-center gap-2">
              {canEdit ? (
                <Button
                  size="md"
                  variant="danger"
                  isDisabled={totalLibraryItems === 0}
                  onPress={() => {
                    setIsClearAllOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Xóa
                </Button>
              ) : null}

              <Button
                size="md"
                variant="primary"
                isDisabled={!canEdit}
                onPress={() => {
                  void handlePlanMix({
                    targetCount: targetMixCount,
                    targetOutputDuration: 20,
                    minHammingDistance: 2,
                    maxShotFrequency: Math.max(2, Math.ceil(targetMixCount / 3)),
                    seed: Date.now(),
                  });
                }}
              >
                <Sparkles className="h-4 w-4" />
                Trộn
              </Button>
            </div>
          </div>
        }
      />

      <PlannedVideosPanel
        folderId={folderId}
        videos={plannedVideos}
        library={library}
        voices={voices}
        canEdit={canEdit}
        canExport={canExport}
        isExpanded={isLibraryCollapsed}
        renderedTupleKeys={effectiveRenderedKeys}
        onUpdateSlot={handleUpdateSlot}
        onChangeVoice={handleChangeVoice}
        onMarkRendered={async (unrecorded) => {
          await handleRecordVideosToHistory(unrecorded, true);
        }}
        onRecordRenderedVideos={async (rendered) => {
          await handleRecordVideosToHistory(rendered, false);
        }}
        onToast={onToast}
      />

      <DriveHistoryDrawer
        key={`${drawerTab}_${historySearch}_${String(historyDrawerOpen)}`}
        isOpen={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
        library={library}
        voices={voices}
        canEdit={canEdit}
        isUploadingVoices={isUploadingVoices}
        voiceMode={mixVoiceMode}
        onVoiceModeChange={setMixVoiceMode}
        initialSearch={historySearch}
        initialTab={drawerTab}
        lastImportSummary={lastImportSummary}
        onIngestCategory={handleIngestCategory}
        onIngestVoices={handleIngestVoices}
        onUploadFiles={handleUploadCategoryFiles}
        onUploadVoices={handleUploadVoices}
        onPreviewClip={setPreviewClip}
        onToggleLockFlip={handleToggleLockFlip}
        onRemoveClip={handleRemoveClip}
        onRemoveVoice={handleRemoveVoice}
        onClearCategory={handleClearCategory}
        onCopied={() => {
          onToast({ type: "info", text: "Đã sao chép link Google Drive." });
        }}
      />

      <Modal
        isOpen={previewClip !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewClip(null);
        }}
        title={previewClip?.name ?? "Xem trước clip"}
        size="md"
      >
        {previewClip ? (
          <video
            src={
              previewClip.source._tag === "DriveClip"
                ? previewClip.source.streamUrl
                : previewClip.source.localUrl
            }
            controls
            autoPlay
            playsInline
            className="mx-auto aspect-[9/16] max-h-96 rounded-xl bg-black object-contain"
          />
        ) : null}
      </Modal>
    </div>
  );
}
