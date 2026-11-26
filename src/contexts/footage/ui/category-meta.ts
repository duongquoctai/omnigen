import type { ShotCategory } from "@/contexts/shared-kernel";
import type { ChipColor } from "@/shared/ui";

export interface CategoryMeta {
  readonly id: ShotCategory;
  readonly shortCode: string;
  readonly folderName: string;
  readonly numberLabel: string;
  readonly hotkey: string;
  readonly chipColor: ChipColor;
  readonly timelineClass: string;
  readonly activeCardClass: string;
  readonly countTextClass: string;
}

const OPEN_META: CategoryMeta = {
  id: "open",
  shortCode: "OPE",
  folderName: "OPEN",
  numberLabel: "1. Open (Hook)",
  hotkey: "1",
  chipColor: "danger",
  timelineClass: "border-rose-500/50 bg-rose-500/20 text-rose-200",
  activeCardClass: "border-rose-500/70 bg-rose-500/10",
  countTextClass: "!text-rose-400",
};

const PRODUCT_META: CategoryMeta = {
  id: "product",
  shortCode: "PRO",
  folderName: "PRODUCT",
  numberLabel: "2. Product",
  hotkey: "2",
  chipColor: "accent",
  timelineClass: "border-blue-500/50 bg-blue-500/20 text-blue-200",
  activeCardClass: "border-blue-500/70 bg-blue-500/10",
  countTextClass: "!text-sky-400",
};

const TEXTURE_META: CategoryMeta = {
  id: "texture",
  shortCode: "TEX",
  folderName: "TEXTURE",
  numberLabel: "3. Texture",
  hotkey: "3",
  chipColor: "warning",
  timelineClass: "border-amber-500/50 bg-amber-500/20 text-amber-200",
  activeCardClass: "border-amber-500/70 bg-amber-500/10",
  countTextClass: "!text-amber-400",
};

const APPLY_META: CategoryMeta = {
  id: "apply",
  shortCode: "APP",
  folderName: "APPLY",
  numberLabel: "4. Apply / Use",
  hotkey: "4",
  chipColor: "success",
  timelineClass: "border-emerald-500/50 bg-emerald-500/20 text-emerald-200",
  activeCardClass: "border-emerald-500/70 bg-emerald-500/10",
  countTextClass: "!text-emerald-400",
};

const END_META: CategoryMeta = {
  id: "end",
  shortCode: "END",
  folderName: "END",
  numberLabel: "5. End (CTA)",
  hotkey: "5",
  chipColor: "accent",
  timelineClass: "border-violet-500/50 bg-violet-500/20 text-violet-200",
  activeCardClass: "border-violet-500/70 bg-violet-500/10",
  countTextClass: "!text-violet-400",
};

export const CATEGORY_META_LIST: ReadonlyArray<CategoryMeta> = [
  OPEN_META,
  PRODUCT_META,
  TEXTURE_META,
  APPLY_META,
  END_META,
];

export const CATEGORY_META_MAP: Record<ShotCategory, CategoryMeta> = {
  open: OPEN_META,
  product: PRODUCT_META,
  texture: TEXTURE_META,
  apply: APPLY_META,
  end: END_META,
};
