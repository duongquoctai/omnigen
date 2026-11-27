import { Option } from "effect";

import {
  type Seconds,
  type ShotCategory,
  type ShotId,
  type SourceVideoId,
} from "@/contexts/shared-kernel";

import { computeSpeedForMinDuration } from "./shot";
import type { CategoryMinDurations, ClassifiedShot, Scene, TimeRange } from "./types";

const CATEGORY_CYCLE = ["open", "product", "texture", "apply"] as const;
const LOOP_POOL = ["apply", "product", "texture"] as const;

const CATEGORY_LABELS: Readonly<Record<ShotCategory, string>> = {
  open: "Open",
  product: "Product",
  texture: "Texture",
  apply: "Apply / Use",
  end: "End (CTA)",
};

const pickCategory = (seqIndex: number): ShotCategory => {
  const initial = CATEGORY_CYCLE.at(seqIndex);
  if (initial !== undefined) return initial;
  const loopIndex = (seqIndex - CATEGORY_CYCLE.length) % LOOP_POOL.length;
  return LOOP_POOL.at(loopIndex) ?? "apply";
};

const findEndCutIndex = (
  scenes: ReadonlyArray<Scene>,
  totalVideoDur: number,
  minEndDur: number,
): number => {
  if (scenes.length < 2) return scenes.length - 1;
  const search = (i: number): number => {
    if (i < 1) return scenes.length - 1;
    const scene = scenes.at(i);
    if (scene && totalVideoDur - scene.range.begin >= minEndDur) {
      return i;
    }
    return search(i - 1);
  };
  return search(scenes.length - 1);
};

const makeClassifiedShot = (params: {
  readonly id: ShotId;
  readonly sourceVideoId: SourceVideoId;
  readonly index: number;
  readonly begin: Seconds;
  readonly end: Seconds;
  readonly category: ShotCategory;
  readonly targetMin: number;
}): ClassifiedShot => {
  const rawDur = Number((params.end - params.begin).toFixed(2));
  const speed = computeSpeedForMinDuration(rawDur, params.targetMin);
  const range = { begin: params.begin, end: params.end } as TimeRange;
  return {
    _tag: "ClassifiedShot",
    id: params.id,
    sourceVideoId: params.sourceVideoId,
    label: `${CATEGORY_LABELS[params.category]} - Cảnh #${String(params.index + 1)}`,
    range,
    detectedRange: range,
    contentHash: Option.none(),
    category: params.category,
    edits: {
      flip: { _tag: "Unflipped", locked: true },
      speed,
      zoom: { _tag: "NoZoom" },
      crop: Option.none(),
      transition: { _tag: "NoTransition" },
    },
  };
};

export interface GroupScenesResult {
  readonly shots: ReadonlyArray<ClassifiedShot>;
  readonly slowMoCount: number;
}

export const groupScenesIntoShots = (params: {
  readonly scenes: ReadonlyArray<Scene>;
  readonly sourceVideoId: SourceVideoId;
  readonly minDurations: CategoryMinDurations;
  readonly makeId: (index: number) => ShotId;
}): GroupScenesResult => {
  const { scenes, sourceVideoId, minDurations, makeId } = params;
  const firstScene = scenes.at(0);
  const lastScene = scenes.at(-1);
  if (!firstScene || !lastScene) {
    return { shots: [], slowMoCount: 0 };
  }

  const totalVideoDur = lastScene.range.end;
  const minEndDur = minDurations.end;
  const endCutIndex = findEndCutIndex(scenes, totalVideoDur, minEndDur);
  const endScene = scenes.at(endCutIndex) ?? lastScene;
  const endStart = endScene.range.begin;

  const advanceUntilMin = (
    cutIdx: number,
    curStart: Seconds,
    targetMin: number,
    curEnd: Seconds,
  ): readonly [number, Seconds] => {
    if (cutIdx >= endCutIndex || curEnd - curStart >= targetMin) {
      return [cutIdx, curEnd] as const;
    }
    const nextScene = scenes.at(cutIdx);
    if (!nextScene) {
      return [cutIdx, curEnd] as const;
    }
    return advanceUntilMin(cutIdx + 1, curStart, targetMin, nextScene.range.end);
  };

  const buildBody = (
    cutIdx: number,
    seqIdx: number,
    curStart: Seconds,
    acc: ReadonlyArray<ClassifiedShot>,
  ): ReadonlyArray<ClassifiedShot> => {
    if (cutIdx >= endCutIndex) return acc;
    const cat = pickCategory(seqIdx);
    const targetMin = minDurations[cat];
    const startScene = scenes.at(cutIdx);
    if (!startScene) return acc;

    const [nextCutIdx, segEnd] = advanceUntilMin(
      cutIdx + 1,
      curStart,
      targetMin,
      startScene.range.end,
    );

    const shot = makeClassifiedShot({
      id: makeId(acc.length),
      sourceVideoId,
      index: acc.length,
      begin: curStart,
      end: segEnd,
      category: cat,
      targetMin,
    });

    return buildBody(nextCutIdx, seqIdx + 1, segEnd, [...acc, shot]);
  };

  const bodyShots = buildBody(0, 0, firstScene.range.begin, []);
  const endShot = makeClassifiedShot({
    id: makeId(bodyShots.length),
    sourceVideoId,
    index: bodyShots.length,
    begin: endStart,
    end: totalVideoDur,
    category: "end",
    targetMin: minEndDur,
  });

  const shots = [...bodyShots, endShot];
  const slowMoCount = shots.filter((s) => s.edits.speed < 0.999).length;
  return { shots, slowMoCount };
};
