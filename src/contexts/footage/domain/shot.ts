import { Match, Result, Schema } from "effect";

import { Seconds, type ShotCategory, type ShotId } from "@/contexts/shared-kernel";

import { NoNextShotToMerge, ShotNotFound, SplitPointOutOfRange } from "./errors";
import {
  type CategoryMinDurations,
  ClassifiedShot,
  type Shot,
  Speed,
  type TimeRange,
  type Zoom,
} from "./types";

const roundTenths = (n: number): number => Math.round(n * 10) / 10;

const toSeconds = (n: number): Seconds => Math.max(0, n) as Seconds;

const makeTimeRange = (begin: number, end: number): TimeRange =>
  ({ begin: toSeconds(begin), end: toSeconds(end) }) as TimeRange;

export const DEFAULT_MIN_DURATIONS: CategoryMinDurations = {
  open: 5.8 as Seconds,
  product: 3.0 as Seconds,
  texture: 4.0 as Seconds,
  apply: 4.0 as Seconds,
  end: 4.0 as Seconds,
};

export const computeSpeedForMinDuration = (rawDuration: number, minDuration: number): Speed => {
  if (rawDuration <= 0.05 || minDuration <= 0.05 || rawDuration >= minDuration) {
    return 1 as Speed;
  }
  const calculated = rawDuration / minDuration;
  const clamped = Math.min(10, Math.max(0.1, Math.round(calculated * 1000) / 1000));
  return clamped as Speed;
};

export const applyMinDuration = (shot: Shot, minDurations: CategoryMinDurations): Shot =>
  Match.value(shot).pipe(
    Match.tag("DraftShot", (draft) => draft),
    Match.tag("ClassifiedShot", (classified) => {
      const rawDur = Math.max(0.1, classified.range.end - classified.range.begin);
      const minDur = minDurations[classified.category];
      const speed = computeSpeedForMinDuration(rawDur, minDur);
      return {
        ...classified,
        edits: { ...classified.edits, speed },
      };
    }),
    Match.exhaustive,
  );

export const classifyShot = (
  shot: Shot,
  category: ShotCategory,
  minDurations: CategoryMinDurations,
): ClassifiedShot => {
  const classified: ClassifiedShot = {
    _tag: "ClassifiedShot",
    id: shot.id,
    sourceVideoId: shot.sourceVideoId,
    label: shot.label,
    range: shot.range,
    detectedRange: shot.detectedRange,
    contentHash: shot.contentHash,
    edits: shot.edits,
    category,
  };
  return applyMinDuration(classified, minDurations) as ClassifiedShot;
};

export const splitShotAt = (
  shots: ReadonlyArray<Shot>,
  shotId: ShotId,
  targetSec: number,
  newSecondId: ShotId,
  minDurations: CategoryMinDurations,
): Result.Result<readonly [ReadonlyArray<Shot>, ShotId], ShotNotFound | SplitPointOutOfRange> => {
  const target = shots.find((s) => s.id === shotId);
  if (!target) {
    return Result.fail(new ShotNotFound({ shotId, message: `Không tìm thấy shot ${shotId}.` }));
  }

  const cutPoint =
    targetSec > target.range.begin + 0.2 && targetSec < target.range.end - 0.2
      ? roundTenths(targetSec)
      : roundTenths((target.range.begin + target.range.end) / 2);

  if (cutPoint <= target.range.begin + 0.2 || cutPoint >= target.range.end - 0.2) {
    return Result.fail(
      new SplitPointOutOfRange({
        shotId,
        message: "Shot quá ngắn để tách đôi tại mốc thời gian này.",
      }),
    );
  }

  const firstHalf = applyMinDuration(
    {
      ...target,
      range: makeTimeRange(target.range.begin, cutPoint),
      detectedRange: makeTimeRange(target.detectedRange.begin, cutPoint),
      label: `${target.label} (P1)`,
    },
    minDurations,
  );

  const secondHalf = applyMinDuration(
    {
      ...target,
      id: newSecondId,
      range: makeTimeRange(cutPoint, target.range.end),
      detectedRange: makeTimeRange(cutPoint, target.detectedRange.end),
      label: `${target.label} (P2)`,
    },
    minDurations,
  );

  const nextShots = shots.flatMap((s) => (s.id === shotId ? [firstHalf, secondHalf] : [s]));
  return Result.succeed([nextShots, secondHalf.id] as const);
};

export const mergeShotWithNext = (
  shots: ReadonlyArray<Shot>,
  shotId: ShotId,
  minDurations: CategoryMinDurations,
): Result.Result<readonly [ReadonlyArray<Shot>, ShotId], ShotNotFound | NoNextShotToMerge> => {
  const idx = shots.findIndex((s) => s.id === shotId);
  if (idx === -1) {
    return Result.fail(new ShotNotFound({ shotId, message: `Không tìm thấy shot ${shotId}.` }));
  }
  const current = shots.at(idx);
  const next = shots.at(idx + 1);
  if (!current || !next) {
    return Result.fail(
      new NoNextShotToMerge({
        shotId,
        message: "Không có shot kế tiếp liền kề để gộp.",
      }),
    );
  }

  const merged = applyMinDuration(
    {
      ...current,
      range: makeTimeRange(current.range.begin, next.range.end),
      detectedRange: makeTimeRange(current.detectedRange.begin, next.detectedRange.end),
      label: `${current.label} + ${next.label}`,
    },
    minDurations,
  );

  const nextShots = [...shots.slice(0, idx), merged, ...shots.slice(idx + 2)];
  return Result.succeed([nextShots, merged.id] as const);
};

export const trimShot = (
  shot: Shot,
  newBegin: number,
  newEnd: number,
  maxDuration: number,
  minDurations: CategoryMinDurations,
): Shot => {
  const safeMax = Math.max(0.2, maxDuration);
  const roundedBegin = Math.max(0, Math.min(safeMax - 0.2, roundTenths(newBegin)));
  const roundedEnd = Math.max(roundedBegin + 0.2, Math.min(safeMax, roundTenths(newEnd)));
  return applyMinDuration(
    {
      ...shot,
      range: makeTimeRange(roundedBegin, roundedEnd),
    },
    minDurations,
  );
};

export const toggleShotFlip = (shot: Shot): Shot => ({
  ...shot,
  edits: {
    ...shot.edits,
    flip: Match.value(shot.edits.flip).pipe(
      Match.tag("Unflipped", ({ locked }) => ({ _tag: "Flipped" as const, locked })),
      Match.tag("Flipped", ({ locked }) => ({ _tag: "Unflipped" as const, locked })),
      Match.exhaustive,
    ),
  },
});

export const toggleShotFlipLock = (shot: Shot): Shot => ({
  ...shot,
  edits: {
    ...shot.edits,
    flip: {
      ...shot.edits.flip,
      locked: !shot.edits.flip.locked,
    },
  },
});

export const setShotSpeed = (shot: Shot, speed: Speed): Shot => ({
  ...shot,
  edits: { ...shot.edits, speed },
});

export const setShotZoom = (shot: Shot, zoom: Zoom): Shot => ({
  ...shot,
  edits: { ...shot.edits, zoom },
});

export const deleteShot = (shots: ReadonlyArray<Shot>, shotId: ShotId): ReadonlyArray<Shot> =>
  shots.filter((s) => s.id !== shotId);

export const publishableShots = (shots: ReadonlyArray<Shot>): ReadonlyArray<ClassifiedShot> =>
  shots.filter(Schema.is(ClassifiedShot));
