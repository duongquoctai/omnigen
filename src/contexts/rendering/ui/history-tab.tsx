"use client";

import { Option } from "effect";
import {
  ArrowUpDown,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { ClipLibrary, VoiceClip } from "@/contexts/composition";
import type { FolderId } from "@/contexts/shared-kernel";
import {
  pollRenderProgress,
  renderComposedBatch,
  type RenderProgressSnapshot,
  type RenderVoicePayload,
} from "@/shared/lib/render-client";
import {
  ActionMenuDropdown,
  type ActionMenuItem,
  BusyModal,
  Button,
  ConfirmDialog,
  Heading,
  SearchInput,
  StudioCard,
  Text,
} from "@/shared/ui";

import type { RenderedRecord } from "../domain/types";
import {
  clearRenderedHistoryAction,
  deleteRenderedRecordAction,
  listRenderedHistoryAction,
  toggleRecordUsedAction,
} from "./actions";
import { HistoryDetailDrawer } from "./history-detail-drawer";
import {
  exportHistoryFile,
  extractRenderedPayload,
  toRenderVideoPayloadFromRecord,
} from "./history-payload";
import { HistoryTable } from "./history-table";

export interface HistoryTabProps {
  readonly folderId?: FolderId | undefined;
  readonly initialRecords: ReadonlyArray<RenderedRecord>;
  readonly voices?: ReadonlyArray<VoiceClip> | undefined;
  readonly library?: ClipLibrary | undefined;
  readonly canEdit: boolean;
  readonly canExport?: boolean | undefined;
  readonly onRecordsChange?: ((records: ReadonlyArray<RenderedRecord>) => void) | undefined;
  readonly onToast?: (toast: {
    readonly type: "info" | "success" | "error";
    readonly text: string;
  }) => void;
}

type StatusFilter = "all" | "unused" | "used";
type SortOrder = "newest" | "oldest";

const toRenderVoicesPayload = (
  voices: ReadonlyArray<VoiceClip>,
): ReadonlyArray<RenderVoicePayload> =>
  voices.map((v) => ({
    id: v.id,
    localPath: v.localPath._tag === "Some" ? v.localPath.value : undefined,
    localUrl: v.localUrl,
  }));

export function HistoryTab({
  folderId,
  initialRecords,
  voices = [],
  library,
  canEdit,
  canExport = true,
  onRecordsChange,
  onToast,
}: HistoryTabProps) {
  const [localRecords, setLocalRecords] = useState<ReadonlyArray<RenderedRecord>>(initialRecords);
  const records = onRecordsChange ? initialRecords : localRecords;
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<RenderProgressSnapshot | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RenderedRecord | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const updateRecords = (
    updater: (prev: ReadonlyArray<RenderedRecord>) => ReadonlyArray<RenderedRecord>,
  ) => {
    if (onRecordsChange) {
      onRecordsChange(updater(records));
      return;
    }
    setLocalRecords(updater);
  };

  const usedCount = useMemo(() => records.filter((r) => r.status === "used").length, [records]);
  const unusedCount = records.length - usedCount;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records.filter((rec) => {
      if (filter === "used" && rec.status !== "used") return false;
      if (filter === "unused" && rec.status !== "unused") return false;
      if (!q) return true;
      if (rec.name.toLowerCase().includes(q)) return true;
      if (rec.tupleKey.toLowerCase().includes(q)) return true;
      const view = extractRenderedPayload(rec, voices);
      if (view.voiceName?.toLowerCase().includes(q)) return true;
      return view.slots.some((s) => s.label.toLowerCase().includes(q));
    });

    return [...list].sort((a, b) => {
      const cmp = a.renderedAt.localeCompare(b.renderedAt);
      return sortOrder === "newest" ? -cmp : cmp;
    });
  }, [records, filter, query, sortOrder, voices]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const selectedRecord = useMemo(
    () => (selectedRecordId ? (records.find((r) => r.id === selectedRecordId) ?? null) : null),
    [records, selectedRecordId],
  );

  const handleToggleUsed = async (rec: RenderedRecord) => {
    const nextUsed = rec.status !== "used";
    setPendingId(rec.id);
    updateRecords((prev) =>
      prev.map((item) =>
        item.id === rec.id ? { ...item, status: nextUsed ? "used" : "unused" } : item,
      ),
    );
    const res = await toggleRecordUsedAction({
      recordId: rec.id,
      used: nextUsed,
    });
    setPendingId(null);
    if (!res.ok) {
      updateRecords((prev) =>
        prev.map((item) => (item.id === rec.id ? { ...item, status: rec.status } : item)),
      );
      onToast?.({ type: "error", text: res.error });
      return;
    }
    onToast?.({
      type: "success",
      text: nextUsed ? "Đã đánh dấu video là đã sử dụng." : "Đã chuyển video về chưa sử dụng.",
    });
  };

  const handleDelete = async (rec: RenderedRecord) => {
    setPendingId(rec.id);
    const res = await deleteRenderedRecordAction({ recordId: rec.id });
    setPendingId(null);
    setConfirmDelete(null);
    if (!res.ok) {
      onToast?.({ type: "error", text: res.error });
      return;
    }
    if (selectedRecordId === rec.id) {
      setSelectedRecordId(null);
    }
    updateRecords((prev) => prev.filter((item) => item.id !== rec.id));
    onToast?.({ type: "success", text: `Đã xóa "${rec.name}" khỏi lịch sử.` });
  };

  const handleRefresh = async () => {
    if (!folderId) return;
    setIsRefreshing(true);
    const res = await listRenderedHistoryAction({ folderId });
    setIsRefreshing(false);
    if (!res.ok) {
      onToast?.({ type: "error", text: res.error });
      return;
    }
    const hydrated: ReadonlyArray<RenderedRecord> = res.data.records.map((r) => ({
      ...r,
      outputUrl: r.outputUrl ? Option.some(r.outputUrl) : Option.none(),
    }));
    updateRecords(() => hydrated);
    onToast?.({
      type: "info",
      text: `Đã làm mới ${String(hydrated.length)} video.`,
    });
  };

  const handleClearAll = async () => {
    if (!folderId) return;
    setIsClearing(true);
    const res = await clearRenderedHistoryAction({ folderId });
    setIsClearing(false);
    setConfirmClearAll(false);
    if (!res.ok) {
      onToast?.({ type: "error", text: res.error });
      return;
    }
    setSelectedRecordId(null);
    updateRecords(() => []);
    onToast?.({ type: "success", text: "Đã xóa toàn bộ lịch sử render." });
  };

  const handleDownloadMp4 = async (rec: RenderedRecord) => {
    const view = extractRenderedPayload(rec, voices);
    const payload = toRenderVideoPayloadFromRecord(rec, view, library);
    if (!payload) {
      onToast?.({
        type: "error",
        text: "Video này không lưu đủ thông tin cảnh để tải lại MP4.",
      });
      return;
    }
    const sessionId = folderId ?? rec.folderId;
    setDownloadingId(rec.id);
    setRenderProgress({
      active: true,
      current: 0,
      total: 1,
      percent: 5,
      current_name: rec.name,
    });
    const timer = setInterval(() => {
      void pollRenderProgress(sessionId).then((snap) => {
        if (snap.active) setRenderProgress(snap);
      });
    }, 800);
    try {
      const result = await renderComposedBatch({
        sessionId,
        videos: [payload],
        voices: toRenderVoicesPayload(voices),
      });
      onToast?.({ type: "success", text: `Đã tải lại ${result.fileName}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể xuất lại video MP4.";
      onToast?.({ type: "error", text: msg });
    } finally {
      clearInterval(timer);
      setDownloadingId(null);
      setRenderProgress(null);
    }
  };

  const exportMenuItems: ReadonlyArray<ActionMenuItem> = [
    {
      id: "xlsx",
      label: "Xuất Excel (.xlsx)",
      description: "Đầy đủ 17 cột kèm link Google Drive",
      icon: <FileSpreadsheet className="h-4 w-4 text-emerald-400" />,
      onAction: () => {
        exportHistoryFile(filtered, voices, "xlsx");
        onToast?.({
          type: "success",
          text: `Đã xuất ${String(filtered.length)} video ra file Excel.`,
        });
      },
    },
    {
      id: "csv",
      label: "Xuất CSV (.csv)",
      description: "Định dạng bảng chuẩn UTF-8",
      icon: <FileText className="h-4 w-4 text-sky-400" />,
      onAction: () => {
        exportHistoryFile(filtered, voices, "csv");
        onToast?.({
          type: "success",
          text: `Đã xuất ${String(filtered.length)} video ra file CSV.`,
        });
      },
    },
  ];

  return (
    <div className="space-y-4">
      <StudioCard className="border-zinc-800/90 bg-[#0b0d18]">
        <div className="flex flex-col gap-4">
          {/* Hàng trên: Tiêu đề + 3 nút hành động */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
                <History className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Heading level={2} className="text-base font-semibold text-zinc-100">
                    Lịch sử video đã render
                  </Heading>
                  <span className="rounded-full border border-indigo-500/35 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-200">
                    {records.length} video
                  </span>
                </div>
                <Text variant="caption" className="text-zinc-400">
                  Quản lý trạng thái sử dụng của từng video đã xuất file. Thuật toán tự động ghi
                  nhận và loại trừ các cảnh này khi tạo mẻ video mới.
                </Text>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canExport ? (
                <ActionMenuDropdown
                  ariaLabel="Xuất file lịch sử render"
                  isDisabled={filtered.length === 0}
                  items={exportMenuItems}
                  triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  trigger={
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Xuất file</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-80" />
                    </>
                  }
                />
              ) : null}

              {folderId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  isLoading={isRefreshing}
                  onPress={() => {
                    void handleRefresh();
                  }}
                  className="h-9 border border-zinc-800 bg-zinc-900/60 text-zinc-200 hover:bg-zinc-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Làm mới
                </Button>
              ) : null}

              {canEdit && folderId ? (
                <Button
                  size="sm"
                  variant="danger"
                  isDisabled={records.length === 0 || isClearing}
                  onPress={() => {
                    setConfirmClearAll(true);
                  }}
                  className="h-9 !bg-rose-600 !text-white hover:!bg-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Xóa toàn bộ lịch sử
                </Button>
              ) : null}
            </div>
          </div>

          {/* Hàng dưới: Filter trạng thái + Search + Sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-3">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800/90 bg-[#070811] p-1">
              <Button
                size="sm"
                variant={filter === "all" ? "primary" : "ghost"}
                onPress={() => {
                  setFilter("all");
                  setPage(1);
                }}
                className={
                  filter === "all"
                    ? "h-7 rounded-lg !bg-indigo-600 px-3 text-xs !text-white"
                    : "h-7 rounded-lg px-3 text-xs text-zinc-400 hover:text-zinc-200"
                }
              >
                Tất cả ({records.length})
              </Button>
              <Button
                size="sm"
                variant={filter === "unused" ? "primary" : "ghost"}
                onPress={() => {
                  setFilter("unused");
                  setPage(1);
                }}
                className={
                  filter === "unused"
                    ? "h-7 rounded-lg !bg-zinc-700 px-3 text-xs !text-white"
                    : "h-7 rounded-lg px-3 text-xs text-zinc-400 hover:text-zinc-200"
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                Chưa sử dụng ({unusedCount})
              </Button>
              <Button
                size="sm"
                variant={filter === "used" ? "primary" : "ghost"}
                onPress={() => {
                  setFilter("used");
                  setPage(1);
                }}
                className={
                  filter === "used"
                    ? "h-7 rounded-lg !bg-emerald-600 px-3 text-xs !text-white"
                    : "h-7 rounded-lg px-3 text-xs text-zinc-400 hover:text-zinc-200"
                }
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Đã sử dụng ({usedCount})
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-60 sm:w-64">
                <SearchInput
                  value={query}
                  onValueChange={(val) => {
                    setQuery(val);
                    setPage(1);
                  }}
                  placeholder="Tìm theo tên video, cảnh..."
                  ariaLabel="Tìm theo tên video, cảnh"
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"));
                  setPage(1);
                }}
                className="h-9 border border-zinc-800 bg-[#070811] px-3 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortOrder === "newest" ? "Mới nhất trước" : "Cũ nhất trước"}
              </Button>
            </div>
          </div>
        </div>
      </StudioCard>

      <HistoryTable
        records={pagedRecords}
        totalCount={filtered.length}
        page={safePage}
        pageSize={pageSize}
        totalPages={totalPages}
        voices={voices}
        selectedRecordId={selectedRecordId}
        canEdit={canEdit}
        canExport={canExport}
        pendingId={pendingId}
        downloadingId={downloadingId}
        onSelectRecord={(rec) => {
          setSelectedRecordId(rec.id);
        }}
        onToggleUsed={(rec) => {
          void handleToggleUsed(rec);
        }}
        onDownloadMp4={(rec) => {
          void handleDownloadMp4(rec);
        }}
        onRequestDelete={(rec) => {
          setConfirmDelete(rec);
        }}
        onPageChange={setPage}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
      />

      <HistoryDetailDrawer
        record={selectedRecord}
        voices={voices}
        canEdit={canEdit}
        canExport={canExport}
        isDownloading={downloadingId !== null && downloadingId === selectedRecord?.id}
        onClose={() => {
          setSelectedRecordId(null);
        }}
        onToggleUsed={(rec) => {
          void handleToggleUsed(rec);
        }}
        onDownloadMp4={(rec) => {
          void handleDownloadMp4(rec);
        }}
      />

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Xóa video khỏi lịch sử render?"
        description={
          confirmDelete
            ? `Video "${confirmDelete.name}" sẽ bị xóa khỏi lịch sử. Tổ hợp cảnh của video này có thể xuất hiện lại ở lần trộn sau.`
            : ""
        }
        confirmLabel="Xóa khỏi lịch sử"
        isDestructive
        isLoading={pendingId !== null}
        onConfirm={() => {
          if (confirmDelete) void handleDelete(confirmDelete);
        }}
      />

      <ConfirmDialog
        isOpen={confirmClearAll}
        onOpenChange={(open) => {
          if (!open) setConfirmClearAll(false);
        }}
        title="Xóa toàn bộ lịch sử render?"
        description={`Toàn bộ ${String(records.length)} video trong lịch sử của thư mục này sẽ bị xóa vĩnh viễn và không thể khôi phục.`}
        confirmLabel="Xóa toàn bộ"
        isDestructive
        isLoading={isClearing}
        onConfirm={() => {
          void handleClearAll();
        }}
      />

      <BusyModal
        isOpen={downloadingId !== null}
        title="Đang xuất lại file MP4"
        message={
          renderProgress?.current_name
            ? `Đang ghép "${renderProgress.current_name}" qua FFmpeg...`
            : "Đang ghép 5 cảnh và lồng tiếng qua FFmpeg..."
        }
        progress={
          renderProgress
            ? {
                current: renderProgress.current,
                total: renderProgress.total || 1,
                percent: renderProgress.percent,
                label: "Tiến độ render",
              }
            : null
        }
      />
    </div>
  );
}
