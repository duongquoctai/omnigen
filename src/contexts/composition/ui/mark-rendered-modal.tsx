"use client";

import { CheckCheck, Info } from "lucide-react";

import { Button, Modal, SurfaceBox, Text } from "@/shared/ui";

export interface MarkRenderedModalProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly totalVideosCount: number;
  readonly unrecordedCount: number;
  readonly isSubmitting: boolean;
  readonly onConfirm: () => void;
}

export function MarkRenderedModal({
  isOpen,
  onOpenChange,
  totalVideosCount,
  unrecordedCount,
  isSubmitting,
  onConfirm,
}: MarkRenderedModalProps) {
  const skippedCount = Math.max(0, totalVideosCount - unrecordedCount);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Xác nhận đánh dấu tất cả đã render"
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
            <CheckCheck className="h-5 w-5" />
          </div>
          <Text variant="body" className="text-xs leading-relaxed text-slate-300">
            Bạn có chắc muốn đánh dấu toàn bộ {totalVideosCount} video trong danh sách tổ hợp này đã
            render?
          </Text>
        </div>

        <SurfaceBox className="space-y-1.5 rounded-xl border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-2 font-medium text-emerald-300">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Chi tiết thực hiện:</span>
          </div>
          <ul className="list-inside list-disc space-y-1 pl-1 text-slate-300">
            <li>
              {unrecordedCount > 0
                ? `Sẽ thêm ${String(unrecordedCount)} video mới vào lịch sử render (bỏ qua ${String(skippedCount)} video đã có trong lịch sử).`
                : "Toàn bộ video trong danh sách đều đã có trong lịch sử render."}
            </li>
            <li>
              Hệ thống coi như bỏ qua bước tải MP4 về máy và lưu mã tổ hợp để tránh trùng lặp ở các
              lần trộn tiếp theo.
            </li>
          </ul>
        </SurfaceBox>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-3">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={isSubmitting}
            onPress={() => {
              onOpenChange(false);
            }}
          >
            Hủy bỏ
          </Button>
          <Button
            size="sm"
            variant="primary"
            isLoading={isSubmitting}
            isDisabled={isSubmitting || unrecordedCount === 0}
            onPress={onConfirm}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {!isSubmitting ? <CheckCheck className="h-3.5 w-3.5" /> : null}
            {isSubmitting
              ? "Đang ghi nhận..."
              : unrecordedCount === 0
                ? "Đã có trong lịch sử"
                : "Đồng ý đánh dấu"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
