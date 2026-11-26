"use client";

import { Layers } from "lucide-react";

import type { ShotCategory } from "@/contexts/shared-kernel";
import { KbdChip, StatusChip, StudioCard, Text } from "@/shared/ui";

import type { Shot } from "../domain/types";
import { CATEGORY_META_LIST } from "./category-meta";

export interface SplitStatsShortcutsBarProps {
  readonly shots: ReadonlyArray<Shot>;
}

export function SplitStatsShortcutsBar({ shots }: SplitStatsShortcutsBarProps) {
  const countByCategory = (catId: ShotCategory): number =>
    shots.filter((s) => s._tag === "ClassifiedShot" && s.category === catId).length;

  return (
    <StudioCard className="border-zinc-800/90 bg-[#0b0d18]" bodyClassName="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <Text
              variant="label"
              className="text-xs font-semibold tracking-wider text-zinc-200 uppercase"
            >
              Thống kê 5 nhóm cảnh cắt:
            </Text>
          </div>
          {CATEGORY_META_LIST.map((cat) => (
            <StatusChip key={cat.id} color={cat.chipColor} variant="soft" size="sm">
              {cat.shortCode}: {countByCategory(cat.id)}
            </StatusChip>
          ))}
        </div>

        <div className="hidden flex-wrap items-center gap-2 text-xs text-zinc-400 xl:flex">
          <Text variant="caption" className="text-zinc-400">
            Phím tắt:
          </Text>
          <span className="inline-flex items-center gap-1">
            <KbdChip>1-5</KbdChip>
            <Text variant="caption">gán Category</Text>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="inline-flex items-center gap-1">
            <KbdChip>S</KbdChip>
            <Text variant="caption">Tách đôi</Text>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="inline-flex items-center gap-1">
            <KbdChip>M</KbdChip>
            <Text variant="caption">Mirror</Text>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="inline-flex items-center gap-1">
            <KbdChip>L</KbdChip>
            <Text variant="caption">Khoá chữ</Text>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="inline-flex items-center gap-1">
            <KbdChip>Space</KbdChip>
            <Text variant="caption">Play/Dừng</Text>
          </span>
        </div>
      </div>
    </StudioCard>
  );
}
