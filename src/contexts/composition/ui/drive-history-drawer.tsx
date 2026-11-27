"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

import { SHOT_CATEGORY_VALUES, type ShotCategory } from "@/contexts/shared-kernel";
import {
  Button,
  type ChipColor,
  Modal,
  SearchInput,
  StudioDrawer,
  SurfaceBox,
  TextAreaField,
} from "@/shared/ui";

import { extractGoogleDriveFileId } from "../domain/drive-parser";
import type { Clip, ClipLibrary, VoiceClip } from "../domain/types";
import { CategoryColumn } from "./category-column";
import type { ImportSummaryCounts } from "./clip-library-board";
import { DriveHistoryTable } from "./drive-history-table";
import { VoiceLibrary } from "./voice-library";

export type DriveDrawerTab = "processing" | "processed";
type CategoryFilter = "all" | ShotCategory | "voice";

export interface DriveHistoryDrawerProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly library: ClipLibrary;
  readonly voices: ReadonlyArray<VoiceClip>;
  readonly canEdit: boolean;
  readonly isUploadingVoices?: boolean | undefined;
  readonly voiceMode?: "rotate" | "none" | undefined;
  readonly onVoiceModeChange?: ((mode: "rotate" | "none") => void) | undefined;
  readonly initialSearch?: string | undefined;
  readonly initialTab?: DriveDrawerTab | undefined;
  readonly lastImportSummary?: ImportSummaryCounts | null | undefined;
  readonly onIngestCategory: (category: ShotCategory, urls: ReadonlyArray<string>) => Promise<void>;
  readonly onIngestVoices: (urls: ReadonlyArray<string>) => Promise<void>;
  readonly onUploadFiles?: ((category: ShotCategory, files: FileList) => Promise<void>) | undefined;
  readonly onUploadVoices?: ((files: FileList) => Promise<void>) | undefined;
  readonly onPreviewClip: (clip: Clip) => void;
  readonly onToggleLockFlip?: ((clipId: Clip["id"]) => void) | undefined;
  readonly onRemoveClip: (clipId: Clip["id"]) => Promise<void>;
  readonly onRemoveVoice: (voiceId: VoiceClip["id"]) => Promise<void>;
  readonly onClearCategory: (category: ShotCategory) => Promise<void>;
  readonly onCopied?: ((url: string) => void) | undefined;
}

interface ProcessedEntry {
  readonly id: string;
  readonly category: ShotCategory | "voice";
  readonly categoryLabel: string;
  readonly chipColor: ChipColor;
  readonly name: string;
  readonly url: string | null;
  readonly duration: number;
  readonly clip?: Clip | undefined;
  readonly voice?: VoiceClip | undefined;
}

const CATEGORY_LABELS: Record<ShotCategory, string> = {
  open: "1. Open",
  product: "2. Product",
  texture: "3. Texture",
  apply: "4. Apply / Use",
  end: "5. End (CTA)",
};

const CAT_BADGE: Record<
  ShotCategory | "voice",
  { readonly label: string; readonly color: ChipColor }
> = {
  open: { label: "OPEN", color: "danger" },
  product: { label: "PRODUCT", color: "accent" },
  texture: { label: "TEXTURE", color: "warning" },
  apply: { label: "APPLY", color: "success" },
  end: { label: "END", color: "accent" },
  voice: { label: "VOICE", color: "accent" },
};

const FILTER_OPTIONS: ReadonlyArray<{
  readonly id: CategoryFilter;
  readonly label: string;
}> = [
  { id: "all", label: "Tất cả" },
  { id: "open", label: "1. Open" },
  { id: "product", label: "2. Product" },
  { id: "texture", label: "3. Texture" },
  { id: "apply", label: "4. Apply" },
  { id: "end", label: "5. End" },
  { id: "voice", label: "Voice" },
];

export function DriveHistoryDrawer({
  isOpen,
  onOpenChange,
  library,
  voices,
  canEdit,
  isUploadingVoices = false,
  voiceMode = "rotate",
  onVoiceModeChange,
  initialSearch = "",
  initialTab = "processing",
  lastImportSummary = null,
  onIngestCategory,
  onIngestVoices,
  onUploadFiles,
  onUploadVoices,
  onPreviewClip,
  onToggleLockFlip,
  onRemoveClip,
  onRemoveVoice,
  onClearCategory,
  onCopied,
}: DriveHistoryDrawerProps) {
  const [activeTab, setActiveTab] = useState<DriveDrawerTab>(initialTab);
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeCategoryModal, setActiveCategoryModal] = useState<ShotCategory | null>(null);
  const [singleModalLinks, setSingleModalLinks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const entries = useMemo<ReadonlyArray<ProcessedEntry>>(() => {
    const out: ProcessedEntry[] = [];
    for (const cat of SHOT_CATEGORY_VALUES) {
      for (const clip of library[cat]) {
        const driveUrl =
          clip.source._tag === "DriveClip"
            ? `https://drive.google.com/file/d/${clip.source.fileId}/view`
            : null;
        out.push({
          id: clip.id,
          category: cat,
          categoryLabel: CAT_BADGE[cat].label,
          chipColor: CAT_BADGE[cat].color,
          name: clip.name,
          url: driveUrl,
          duration: clip.duration,
          clip,
        });
      }
    }
    for (const v of voices) {
      const maybeId = extractGoogleDriveFileId(v.localUrl);
      const driveUrl =
        maybeId._tag === "Some" ? `https://drive.google.com/file/d/${maybeId.value}/view` : null;
      out.push({
        id: v.id,
        category: "voice",
        categoryLabel: CAT_BADGE.voice.label,
        chipColor: CAT_BADGE.voice.color,
        name: v.name,
        url: driveUrl,
        duration: v.duration,
        voice: v,
      });
    }
    return out;
  }, [library, voices]);

  const countsByFilter = useMemo<Record<CategoryFilter, number>>(
    () => ({
      all: entries.length,
      open: library.open.length,
      product: library.product.length,
      texture: library.texture.length,
      apply: library.apply.length,
      end: library.end.length,
      voice: voices.length,
    }),
    [entries.length, library, voices.length],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.url?.toLowerCase().includes(q) ?? false) ||
        e.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [entries, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const recentTotal = lastImportSummary
    ? lastImportSummary.open +
      lastImportSummary.product +
      lastImportSummary.texture +
      lastImportSummary.apply +
      lastImportSummary.end +
      lastImportSummary.voice
    : 0;

  const handleImportSingleCategory = async () => {
    if (!activeCategoryModal) return;
    const lines = singleModalLinks
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length === 0) return;
    setIsSubmitting(true);
    await onIngestCategory(activeCategoryModal, lines);
    setIsSubmitting(false);
    setSingleModalLinks("");
    setActiveCategoryModal(null);
  };

  return (
    <>
      <StudioDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="right"
        title={`Google Drive Import (${String(entries.length)})`}
        dialogClassName="w-full max-w-4xl"
      >
        <div className="flex flex-col gap-4">
          {/* 2 Tabs Switcher: Đang xử lý | Đã xử lý */}
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#070811] p-1">
            <Button
              size="sm"
              variant={activeTab === "processing" ? "primary" : "ghost"}
              onPress={() => {
                setActiveTab("processing");
              }}
              className="flex-1 rounded-lg text-xs font-semibold"
            >
              Đang xử lý {recentTotal > 0 ? `(${String(recentTotal)})` : ""}
            </Button>
            <Button
              size="sm"
              variant={activeTab === "processed" ? "primary" : "ghost"}
              onPress={() => {
                setActiveTab("processed");
              }}
              className="flex-1 rounded-lg text-xs font-semibold"
            >
              Lịch sử ({entries.length})
            </Button>
          </div>

          {activeTab === "processing" ? (
            <div className="space-y-4">
              {lastImportSummary && recentTotal > 0 ? (
                <SurfaceBox className="space-y-1 border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Import thành công ({recentTotal} mục vừa nạp)</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-5 font-mono text-[11px]">
                    {lastImportSummary.open > 0 ? (
                      <span>- {lastImportSummary.open} open</span>
                    ) : null}
                    {lastImportSummary.product > 0 ? (
                      <span>- {lastImportSummary.product} product</span>
                    ) : null}
                    {lastImportSummary.texture > 0 ? (
                      <span>- {lastImportSummary.texture} texture</span>
                    ) : null}
                    {lastImportSummary.apply > 0 ? (
                      <span>- {lastImportSummary.apply} apply</span>
                    ) : null}
                    {lastImportSummary.end > 0 ? <span>- {lastImportSummary.end} end</span> : null}
                    {lastImportSummary.voice > 0 ? (
                      <span>- {lastImportSummary.voice} voice</span>
                    ) : null}
                  </div>
                </SurfaceBox>
              ) : null}

              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {SHOT_CATEGORY_VALUES.map((cat) => (
                  <CategoryColumn
                    key={cat}
                    category={cat}
                    label={CATEGORY_LABELS[cat]}
                    clips={library[cat]}
                    canEdit={canEdit}
                    onOpenAddLinks={(c) => {
                      setSingleModalLinks("");
                      setActiveCategoryModal(c);
                    }}
                    onUploadFiles={onUploadFiles}
                    onPreviewClip={onPreviewClip}
                    onToggleLockFlip={onToggleLockFlip}
                    onRemoveClip={onRemoveClip}
                    onClearCategory={onClearCategory}
                    onCopyLink={onCopied}
                  />
                ))}

                <VoiceLibrary
                  voices={voices}
                  canEdit={canEdit}
                  isUploading={isUploadingVoices}
                  voiceMode={voiceMode}
                  onVoiceModeChange={onVoiceModeChange}
                  onIngestVoices={onIngestVoices}
                  onUploadVoices={onUploadVoices}
                  onRemoveVoice={onRemoveVoice}
                  onCopyLink={onCopied}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <SearchInput
                value={search}
                onValueChange={(val) => {
                  setSearch(val);
                  setPage(1);
                }}
                placeholder="Tìm tên file hoặc Drive File ID..."
              />

              {/* Quick Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTER_OPTIONS.map((opt) => (
                  <Button
                    key={opt.id}
                    size="sm"
                    variant={categoryFilter === opt.id ? "primary" : "ghost"}
                    onPress={() => {
                      setCategoryFilter(opt.id);
                      setPage(1);
                    }}
                    className={`h-7 rounded-lg px-2.5 text-[11px] font-medium ${
                      categoryFilter === opt.id
                        ? ""
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {opt.label} ({countsByFilter[opt.id]})
                  </Button>
                ))}
              </div>

              <DriveHistoryTable
                entries={pagedEntries}
                totalCount={filtered.length}
                page={safePage}
                pageSize={pageSize}
                totalPages={totalPages}
                canEdit={canEdit}
                onPageChange={setPage}
                onPageSizeChange={(nextSize) => {
                  setPageSize(nextSize);
                  setPage(1);
                }}
                onPreviewClip={onPreviewClip}
                onToggleLockFlip={onToggleLockFlip}
                onRemoveClip={onRemoveClip}
                onRemoveVoice={onRemoveVoice}
                onCopied={onCopied}
              />
            </div>
          )}
        </div>
      </StudioDrawer>

      <Modal
        isOpen={activeCategoryModal !== null}
        onOpenChange={(open) => {
          if (!open) setActiveCategoryModal(null);
        }}
        title={
          activeCategoryModal
            ? `Thêm link Drive vào ${CATEGORY_LABELS[activeCategoryModal]}`
            : "Thêm link Drive"
        }
        description="Mỗi dòng một liên kết Google Drive hoặc File ID."
      >
        <div className="space-y-4">
          <TextAreaField
            ariaLabel="Link Google Drive"
            rows={5}
            value={singleModalLinks}
            onValueChange={setSingleModalLinks}
            placeholder="https://drive.google.com/file/d/..."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onPress={() => {
                setActiveCategoryModal(null);
              }}
            >
              Huỷ
            </Button>
            <Button
              variant="primary"
              isLoading={isSubmitting}
              onPress={() => {
                void handleImportSingleCategory();
              }}
            >
              Nhập clip Drive
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
