"use client";

import { Check, FolderOpen, Pencil, Plus, Trash2, X } from "lucide-react";

import type { ShotCategory, ShotId } from "@/contexts/shared-kernel";
import { Button, IconButton, StatusChip, StudioCard, SurfaceBox, Text } from "@/shared/ui";

import type { CategoryMinDurations, Shot, Speed, Zoom } from "../domain/types";
import { CATEGORY_META_LIST, CATEGORY_META_MAP } from "./category-meta";
import { ShotInlineEditor } from "./shot-inline-editor";

const computeEffectiveDuration = (shot: Shot): number =>
  Math.max(0.1, Math.round(((shot.range.end - shot.range.begin) / shot.edits.speed) * 10) / 10);

export interface SplitCategoryInspectorProps {
  readonly shots: ReadonlyArray<Shot>;
  readonly minDurations: CategoryMinDurations;
  readonly activeCategory: ShotCategory;
  readonly selectedShotId: ShotId | null;
  readonly editingShotId: ShotId | null;
  readonly sourceVideoUrl: string | null;
  readonly maxVideoDuration: number;
  readonly canEdit: boolean;
  readonly onSelectCategory: (cat: ShotCategory) => void;
  readonly onSelectShot: (shot: Shot) => void;
  readonly onToggleEditShot: (shotId: ShotId | null) => void;
  readonly onAddManualShot: (category: ShotCategory) => void;
  readonly onRenameShot: (shotId: ShotId, label: string) => void;
  readonly onToggleFlip: (shotId: ShotId) => void;
  readonly onToggleFlipLock: (shotId: ShotId) => void;
  readonly onSetSpeed: (shotId: ShotId, speed: Speed) => void;
  readonly onSetZoom: (shotId: ShotId, zoom: Zoom) => void;
  readonly onClassifyShot: (shotId: ShotId, category: ShotCategory) => void;
  readonly onTrimShot: (shotId: ShotId, begin: number, end: number) => void;
  readonly onDeleteShot: (shotId: ShotId) => void;
  readonly onPlayShot: (shot: Shot) => void;
  readonly onSeekPreview: (time: number) => void;
}

export function SplitCategoryInspector({
  shots,
  minDurations,
  activeCategory,
  selectedShotId,
  editingShotId,
  sourceVideoUrl,
  maxVideoDuration,
  canEdit,
  onSelectCategory,
  onSelectShot,
  onToggleEditShot,
  onAddManualShot,
  onRenameShot,
  onToggleFlip,
  onToggleFlipLock,
  onSetSpeed,
  onSetZoom,
  onClassifyShot,
  onTrimShot,
  onDeleteShot,
  onPlayShot,
  onSeekPreview,
}: SplitCategoryInspectorProps) {
  const categoryShots = shots.filter(
    (s) => s._tag === "ClassifiedShot" && s.category === activeCategory,
  );
  const draftShots = shots.filter((s) => s._tag === "DraftShot");
  const activeMeta = CATEGORY_META_MAP[activeCategory];

  return (
    <StudioCard
      className="border-zinc-800/90 bg-[#0b0d18]"
      title={
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-indigo-400" />
          <Text variant="label" className="text-sm font-semibold text-white">
            Kho video theo 5 category (đã tách từ video gốc)
          </Text>
        </div>
      }
      headerAction={
        <Button
          size="sm"
          variant="tertiary"
          isDisabled={!canEdit || !sourceVideoUrl}
          onPress={() => {
            onAddManualShot(activeCategory);
          }}
          className="border-0 bg-zinc-800/75 text-zinc-200 hover:bg-zinc-700/80"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm shot
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {(() => {
          const catStats = CATEGORY_META_LIST.map((cat) => {
            const catList = shots.filter(
              (s) => s._tag === "ClassifiedShot" && s.category === cat.id,
            );
            const totalEff = catList.reduce((sum, s) => sum + computeEffectiveDuration(s), 0);
            return { cat, catList, totalEff };
          });
          const totalAllCatsDuration = catStats.reduce((sum, item) => sum + item.totalEff, 0);

          return (
            <div className="flex flex-wrap gap-2 sm:flex-nowrap">
              {catStats.map(({ cat, catList, totalEff }) => {
                const isActive = activeCategory === cat.id;
                const isReady = catList.length > 0;
                const flexStyle =
                  totalAllCatsDuration > 0
                    ? {
                        flexGrow: Math.max(0.01, totalEff / totalAllCatsDuration),
                        flexBasis: 0,
                      }
                    : { flexGrow: 1, flexBasis: 0 };

                return (
                  <div
                    key={cat.id}
                    style={flexStyle}
                    className="min-w-[88px] transition-all duration-200"
                  >
                    <Button
                      fullWidth
                      variant="ghost"
                      onPress={() => {
                        onSelectCategory(cat.id);
                      }}
                      className={`flex h-auto w-full min-w-0 flex-col items-stretch justify-between gap-2 rounded-xl border p-2.5 text-left transition ${
                        isActive
                          ? cat.activeCardClass
                          : "border-zinc-800 bg-[#070811] hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <Text
                          variant="label"
                          className={`truncate text-[11px] font-bold ${cat.countTextClass}`}
                        >
                          {cat.folderName}
                        </Text>
                        <Text variant="mono" className="shrink-0 text-xs font-semibold text-white">
                          {totalEff.toFixed(1)}s
                        </Text>
                      </div>
                      <Text
                        variant="caption"
                        className={`w-full text-left text-[11px] font-medium ${cat.countTextClass} ${
                          catList.length === 0 ? "opacity-60" : ""
                        }`}
                      >
                        {catList.length} cảnh
                      </Text>
                      <div className="flex w-full items-center justify-between gap-1 border-t border-zinc-800/80 pt-1.5">
                        <Text variant="mono" className="text-[10px] text-zinc-500">
                          ≥ {minDurations[cat.id].toFixed(1)}s
                        </Text>
                        <Text
                          variant="caption"
                          className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                            isReady ? "text-emerald-400" : "text-zinc-500"
                          }`}
                        >
                          {isReady ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" aria-label="Sẵn sàng" />
                          ) : (
                            "Trống"
                          )}
                        </Text>
                      </div>
                    </Button>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <SurfaceBox className="flex flex-col gap-3 border-zinc-800 bg-[#070811] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusChip color={activeMeta.chipColor} variant="soft" size="sm">
                NHÓM {activeMeta.folderName}
              </StatusChip>
              <Text variant="caption" className="text-zinc-300">
                Danh sách {categoryShots.length} cảnh
              </Text>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="tertiary"
                isDisabled={!canEdit || !sourceVideoUrl}
                onPress={() => {
                  onAddManualShot(activeCategory);
                }}
                className="border-0 bg-zinc-800/75 text-zinc-200 hover:bg-zinc-700/80"
              >
                <Plus className="h-3 w-3" />
                Thêm cảnh
              </Button>
              {editingShotId ? (
                <IconButton
                  aria-label="Đóng chỉnh sửa"
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    onToggleEditShot(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}
            </div>
          </div>

          {categoryShots.length === 0 ? (
            <Text variant="caption" className="py-4 text-center text-zinc-500">
              Nhóm {activeMeta.folderName} chưa có cảnh nào. Bấm “+ Thêm cảnh” hoặc dùng phím tắt
              1-5 để gán cảnh.
            </Text>
          ) : (
            <div className="flex flex-col gap-2">
              {(() => {
                const hasEditingInCategory =
                  categoryShots.length > 1 && categoryShots.some((s) => s.id === editingShotId);

                return categoryShots.map((shot, idx) => {
                  const isSelected = selectedShotId === shot.id;
                  const isEditing = editingShotId === shot.id;
                  const isDimmed = hasEditingInCategory && !isEditing;
                  const effDur = computeEffectiveDuration(shot);
                  const isFlipped = shot.edits.flip._tag === "Flipped";

                  return (
                    <SurfaceBox
                      key={shot.id}
                      className={`flex flex-col gap-2.5 p-2.5 transition-all duration-200 ${
                        isSelected
                          ? "border-indigo-500/60 bg-indigo-950/20"
                          : "border-zinc-800/80 bg-[#0b0d18]"
                      } ${isDimmed ? "opacity-50 hover:opacity-90" : "opacity-100"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            onSelectShot(shot);
                          }}
                          className="flex h-auto min-w-0 flex-1 items-center justify-start gap-2.5 border-0 bg-transparent px-1 py-0.5 text-left hover:bg-transparent active:bg-transparent data-[hovered]:bg-transparent"
                        >
                          <StatusChip color={activeMeta.chipColor} variant="soft" size="sm">
                            #{idx + 1}
                          </StatusChip>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Text
                                variant="label"
                                className="truncate text-xs font-semibold text-white"
                              >
                                {shot.label}
                              </Text>
                              {isFlipped ? (
                                <StatusChip color="accent" variant="soft" size="sm">
                                  Lật gương
                                </StatusChip>
                              ) : null}
                              {shot.edits.speed !== 1 ? (
                                <StatusChip color="warning" variant="soft" size="sm">
                                  {shot.edits.speed}x
                                </StatusChip>
                              ) : null}
                            </div>
                            <Text variant="mono" className="text-[11px] text-zinc-400">
                              {shot.range.begin.toFixed(1)}s → {shot.range.end.toFixed(1)}s •{" "}
                              <span className="text-emerald-400">{effDur.toFixed(1)}s</span>
                            </Text>
                          </div>
                        </Button>

                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton
                            aria-label={`Chỉnh sửa ${shot.label}`}
                            size="sm"
                            variant={isEditing ? "primary" : "ghost"}
                            onPress={() => {
                              onSelectShot(shot);
                              onToggleEditShot(isEditing ? null : shot.id);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton
                            aria-label={`Xoá ${shot.label}`}
                            size="sm"
                            variant="ghost"
                            isDisabled={!canEdit}
                            onPress={() => {
                              onDeleteShot(shot.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                          </IconButton>
                        </div>
                      </div>

                      {isEditing ? (
                        <ShotInlineEditor
                          shot={shot}
                          minDurations={minDurations}
                          maxVideoDuration={maxVideoDuration}
                          canEdit={canEdit}
                          onClose={() => {
                            onToggleEditShot(null);
                          }}
                          onRenameShot={onRenameShot}
                          onToggleFlip={onToggleFlip}
                          onToggleFlipLock={onToggleFlipLock}
                          onSetSpeed={onSetSpeed}
                          onSetZoom={onSetZoom}
                          onClassifyShot={onClassifyShot}
                          onTrimShot={onTrimShot}
                          onDeleteShot={onDeleteShot}
                          onPlayShot={onPlayShot}
                          onSeekPreview={onSeekPreview}
                        />
                      ) : null}
                    </SurfaceBox>
                  );
                });
              })()}
            </div>
          )}

          {draftShots.length > 0 ? (
            <div className="border-t border-zinc-800/80 pt-2">
              <Text variant="caption" className="mb-1.5 block text-amber-300">
                Cảnh chưa phân loại ({draftShots.length}) — bấm chọn rồi nhấn phím 1-5 để gán nhóm:
              </Text>
              <div className="flex flex-wrap gap-1.5">
                {draftShots.map((d) => (
                  <Button
                    key={d.id}
                    size="sm"
                    variant={selectedShotId === d.id ? "primary" : "secondary"}
                    onPress={() => {
                      onSelectShot(d);
                    }}
                  >
                    {d.label} ({d.range.begin.toFixed(1)}–{d.range.end.toFixed(1)}s)
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </SurfaceBox>
      </div>
    </StudioCard>
  );
}
