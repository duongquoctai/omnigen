"use client";

import { CheckCircle2, Cloud, FileSpreadsheet, FolderSync, Minus } from "lucide-react";
import { type InputHTMLAttributes, type ReactNode, useMemo, useRef, useState } from "react";

import { SHOT_CATEGORY_VALUES, type ShotCategory } from "@/contexts/shared-kernel";
import {
  Button,
  ConfirmDialog,
  IconButton,
  StatusChip,
  StudioCard,
  Text,
  TextAreaField,
} from "@/shared/ui";

import { parseExcelSixColumnClipboard } from "../domain/drive-parser";
import type { ClipLibrary, VoiceClip } from "../domain/types";
import { DriveQuickCheck } from "./drive-quick-check";

export interface ImportSummaryCounts {
  readonly open: number;
  readonly product: number;
  readonly texture: number;
  readonly apply: number;
  readonly end: number;
  readonly voice: number;
}

export interface ClipLibraryBoardProps {
  readonly library: ClipLibrary;
  readonly voices?: ReadonlyArray<VoiceClip> | undefined;
  readonly canEdit: boolean;
  readonly uploadProgressText?: string | null | undefined;
  readonly lastImportSummary?: ImportSummaryCounts | null | undefined;
  readonly onIngestCategory: (category: ShotCategory, urls: ReadonlyArray<string>) => Promise<void>;
  readonly onIngestVoices: (urls: ReadonlyArray<string>) => Promise<void>;
  readonly onImportBatchComplete?: ((counts: ImportSummaryCounts) => void) | undefined;
  readonly onUploadMasterFolder?: ((files: FileList) => Promise<void>) | undefined;
  readonly onClearAllCategories?: (() => Promise<void>) | undefined;
  readonly onOpenDriveHistory?:
    ((searchQuery?: string, initialTab?: "processing" | "processed") => void) | undefined;
  readonly footer?: ReactNode | undefined;
  readonly isClearAllOpen?: boolean | undefined;
  readonly onClearAllOpenChange?: ((open: boolean) => void) | undefined;
  readonly isCollapsed?: boolean | undefined;
  readonly onCollapsedChange?: ((collapsed: boolean) => void) | undefined;
}

const SUMMARY_ROWS: ReadonlyArray<{
  readonly key: keyof ImportSummaryCounts;
  readonly label: string;
}> = [
  { key: "open", label: "open" },
  { key: "product", label: "product" },
  { key: "texture", label: "texture" },
  { key: "apply", label: "apply" },
  { key: "end", label: "end" },
  { key: "voice", label: "voice" },
];

export function ClipLibraryBoard({
  library,
  voices = [],
  canEdit,
  uploadProgressText,
  lastImportSummary = null,
  onIngestCategory,
  onIngestVoices,
  onImportBatchComplete,
  onUploadMasterFolder,
  onClearAllCategories,
  onOpenDriveHistory,
  footer,
  isClearAllOpen: controlledClearAllOpen,
  onClearAllOpenChange,
  isCollapsed: controlledCollapsed,
  onCollapsedChange,
}: ClipLibraryBoardProps) {
  const masterFolderRef = useRef<HTMLInputElement | null>(null);
  const [excelPasteText, setExcelPasteText] = useState("");
  const [internalClearAllOpen, setInternalClearAllOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = controlledCollapsed ?? internalCollapsed;
  const setIsCollapsed = onCollapsedChange ?? setInternalCollapsed;

  const isClearAllOpen = controlledClearAllOpen ?? internalClearAllOpen;
  const setIsClearAllOpen = onClearAllOpenChange ?? setInternalClearAllOpen;

  const totalClips =
    library.open.length +
    library.product.length +
    library.texture.length +
    library.apply.length +
    library.end.length;
  const totalItems = totalClips + voices.length;

  const parsedExcel = useMemo(() => parseExcelSixColumnClipboard(excelPasteText), [excelPasteText]);
  const totalExtracted =
    parsedExcel.open.length +
    parsedExcel.product.length +
    parsedExcel.texture.length +
    parsedExcel.apply.length +
    parsedExcel.end.length +
    parsedExcel.voice.length;

  const runExcelIngest = async (rawText: string) => {
    const parsed = parseExcelSixColumnClipboard(rawText);
    const total =
      parsed.open.length +
      parsed.product.length +
      parsed.texture.length +
      parsed.apply.length +
      parsed.end.length +
      parsed.voice.length;
    if (total === 0) return;

    setIsSubmitting(true);
    try {
      for (const cat of SHOT_CATEGORY_VALUES) {
        if (parsed[cat].length > 0) {
          await onIngestCategory(cat, parsed[cat]);
        }
      }
      if (parsed.voice.length > 0) {
        await onIngestVoices(parsed.voice);
      }
      onImportBatchComplete?.({
        open: parsed.open.length,
        product: parsed.product.length,
        texture: parsed.texture.length,
        apply: parsed.apply.length,
        end: parsed.end.length,
        voice: parsed.voice.length,
      });
      setExcelPasteText("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dirAttrs = {
    webkitdirectory: "",
    directory: "",
  } as InputHTMLAttributes<HTMLInputElement>;

  const activeSummaryLines = lastImportSummary
    ? SUMMARY_ROWS.filter((row) => lastImportSummary[row.key] > 0)
    : [];

  return (
    <div className="transition-all duration-300 ease-in-out">
      {/* Collapsed state: single icon button */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? "max-h-14 opacity-100" : "pointer-events-none max-h-0 opacity-0"
        }`}
      >
        <div className="flex items-center justify-end">
          <IconButton
            size="sm"
            variant="secondary"
            aria-label="Mở rộng kho video theo 5 category"
            onPress={() => {
              setIsCollapsed(false);
            }}
            className="h-9 w-9 rounded-xl border border-zinc-800 bg-[#0b0d18] text-sky-400 shadow-md transition hover:border-sky-500/50 hover:bg-zinc-900"
          >
            <Cloud className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {/* Expanded state: full StudioCard with smooth collapse animation */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isCollapsed
            ? "pointer-events-none grid-rows-[0fr] opacity-0"
            : "grid-rows-[1fr] opacity-100"
        }`}
      >
        <div className="overflow-hidden">
          <StudioCard
            className="border-zinc-800/90 bg-[#0b0d18]"
            title={
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-sky-400" />
                <Text variant="label" className="text-sm font-bold text-white">
                  Kho video theo 5 category (Google Drive &amp; máy tính)
                </Text>
              </div>
            }
            description="Mode chính: Dán bảng 5 cột từ Excel (Google Drive) với cơ chế zero-disk stream. Mode phụ: Tải trực tiếp thư mục từ máy tính."
            headerAction={
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    onOpenDriveHistory?.("", "processed");
                  }}
                  className="rounded-xl bg-sky-500/10 text-sky-300 hover:bg-sky-500/20"
                >
                  <Cloud className="h-3.5 w-3.5 text-sky-400" />
                  Google Drive Import ({totalItems})
                </Button>
                {canEdit && onUploadMasterFolder ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      masterFolderRef.current?.click();
                    }}
                    className="rounded-xl bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                  >
                    <FolderSync className="h-3.5 w-3.5 text-indigo-400" />
                    Chọn thư mục tổng
                  </Button>
                ) : null}
                <IconButton
                  size="sm"
                  variant="ghost"
                  aria-label="Thu gọn kho video"
                  onPress={() => {
                    setIsCollapsed(true);
                  }}
                  className="h-8 w-8 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <Minus className="h-4 w-4" />
                </IconButton>
              </div>
            }
          >
            <input
              ref={masterFolderRef}
              type="file"
              multiple
              {...dirAttrs}
              className="hidden"
              aria-label="Chọn thư mục tổng từ máy"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0 && onUploadMasterFolder) {
                  void onUploadMasterFolder(e.target.files);
                }
                e.target.value = "";
              }}
            />

            <div className="space-y-4">
              <DriveQuickCheck
                library={library}
                voices={voices}
                onOpenHistory={(q) => {
                  onOpenDriveHistory?.(q, "processed");
                }}
              />

              {canEdit ? (
                <div
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    const parsed = parseExcelSixColumnClipboard(pasted);
                    const count =
                      parsed.open.length +
                      parsed.product.length +
                      parsed.texture.length +
                      parsed.apply.length +
                      parsed.end.length +
                      parsed.voice.length;
                    if (count > 0) {
                      e.preventDefault();
                      setExcelPasteText(pasted);
                      void runExcelIngest(pasted);
                    }
                  }}
                  className="space-y-3 rounded-xl bg-[#070811] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <Text variant="label" className="text-xs font-bold text-white">
                          Dán nhanh bảng 5 cột từ Excel (Google Drive)
                        </Text>
                        <Text variant="caption" as="div" className="text-[11px] text-zinc-400">
                          Bôi đen cả bảng 5 cột (Open, Product, Texture, Apply, End) trong file
                          Excel rồi dán (Ctrl+V) vào khung bên dưới.
                        </Text>
                      </div>
                    </div>

                    {totalExtracted > 0 ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setExcelPasteText("");
                          }}
                        >
                          Xoá nội dung dán
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          isLoading={isSubmitting}
                          onPress={() => {
                            void runExcelIngest(excelPasteText);
                          }}
                          className="bg-emerald-600 text-white hover:bg-emerald-500"
                        >
                          <Cloud className="h-3.5 w-3.5" />+ Nạp {totalExtracted} file vào kho (5
                          category &amp; voice)
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <TextAreaField
                    ariaLabel="Dán vùng dữ liệu Excel 5-6 cột"
                    rows={3}
                    value={excelPasteText}
                    onValueChange={setExcelPasteText}
                    placeholder="Dán vùng dữ liệu copy từ Excel vào đây (hệ thống tự động phân tách Tab thành các cột: Open, Product, Texture, Apply, End, Voice)..."
                  />

                  {activeSummaryLines.length > 0 ? (
                    <div className="space-y-1 pt-1 text-xs text-emerald-400">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Import thành công</span>
                      </div>
                      <ul className="space-y-0.5 pl-5 font-mono text-[11px] text-emerald-300/90">
                        {activeSummaryLines.map((row) => (
                          <li key={row.key}>
                            - {lastImportSummary?.[row.key]} {row.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : totalItems > 0 ? (
                    <div className="flex flex-wrap items-start justify-between gap-2 pt-1 text-xs text-emerald-400">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Hiện tại đang có:</span>
                        </div>
                        <ul className="space-y-0.5 pl-5 font-mono text-[11px] text-emerald-300/90">
                          {library.open.length > 0 ? <li>- {library.open.length} open</li> : null}
                          {library.product.length > 0 ? (
                            <li>- {library.product.length} product</li>
                          ) : null}
                          {library.texture.length > 0 ? (
                            <li>- {library.texture.length} texture</li>
                          ) : null}
                          {library.apply.length > 0 ? (
                            <li>- {library.apply.length} apply</li>
                          ) : null}
                          {library.end.length > 0 ? <li>- {library.end.length} end</li> : null}
                          {voices.length > 0 ? <li>- {voices.length} voice</li> : null}
                        </ul>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          onOpenDriveHistory?.("", "processing");
                        }}
                        className="h-6 rounded-lg px-2 text-[11px] text-sky-400 hover:bg-sky-500/10"
                      >
                        Quản lý chi tiết trong Google Drive Import →
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {uploadProgressText ? (
                <StatusChip color="accent" variant="soft" size="sm">
                  {uploadProgressText}
                </StatusChip>
              ) : null}

              {footer ? <div className="border-t border-zinc-800/80 pt-4">{footer}</div> : null}
            </div>

            <ConfirmDialog
              isOpen={isClearAllOpen}
              onOpenChange={setIsClearAllOpen}
              title="Xoá toàn bộ kho clip & voice?"
              description="Hành động này sẽ xoá toàn bộ clip trong 5 nhóm cảnh, toàn bộ voice và danh sách tổ hợp đã trộn. Không thể hoàn tác."
              confirmLabel="Xoá toàn bộ"
              isDestructive
              onConfirm={async () => {
                if (onClearAllCategories) {
                  await onClearAllCategories();
                }
                setIsClearAllOpen(false);
              }}
            />
          </StudioCard>
        </div>
      </div>
    </div>
  );
}
