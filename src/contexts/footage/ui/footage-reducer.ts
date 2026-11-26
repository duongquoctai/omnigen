import { Match, Result } from "effect";

import type { ShotCategory, ShotId } from "@/contexts/shared-kernel";

import {
  applyMinDuration,
  classifyShot,
  DEFAULT_MIN_DURATIONS,
  deleteShot,
  mergeShotWithNext,
  setShotSpeed,
  setShotZoom,
  splitShotAt,
  toggleShotFlip,
  toggleShotFlipLock,
  trimShot,
} from "../domain/shot";
import type { CategoryMinDurations, Shot, Speed, Zoom } from "../domain/types";

export interface FootageState {
  readonly shots: ReadonlyArray<Shot>;
  readonly selectedShotId: ShotId | null;
  readonly minDurations: CategoryMinDurations;
  readonly maxVideoDuration: number;
  readonly errorMessage: string | null;
}

export type FootageAction =
  | { readonly _tag: "SetShots"; readonly shots: ReadonlyArray<Shot> }
  | { readonly _tag: "SelectShot"; readonly shotId: ShotId | null }
  | {
      readonly _tag: "ClassifyShot";
      readonly shotId: ShotId;
      readonly category: ShotCategory;
    }
  | {
      readonly _tag: "SplitShot";
      readonly shotId: ShotId;
      readonly targetSec: number;
      readonly newSecondId: ShotId;
    }
  | { readonly _tag: "MergeWithNext"; readonly shotId: ShotId }
  | {
      readonly _tag: "TrimShot";
      readonly shotId: ShotId;
      readonly begin: number;
      readonly end: number;
    }
  | { readonly _tag: "ToggleFlip"; readonly shotId: ShotId }
  | { readonly _tag: "ToggleFlipLock"; readonly shotId: ShotId }
  | { readonly _tag: "SetSpeed"; readonly shotId: ShotId; readonly speed: Speed }
  | { readonly _tag: "SetZoom"; readonly shotId: ShotId; readonly zoom: Zoom }
  | { readonly _tag: "RenameShot"; readonly shotId: ShotId; readonly label: string }
  | { readonly _tag: "AddManualShot"; readonly shot: Shot }
  | {
      readonly _tag: "SetMinDuration";
      readonly category: ShotCategory;
      readonly seconds: number;
    }
  | { readonly _tag: "DeleteShot"; readonly shotId: ShotId }
  | { readonly _tag: "SetMaxVideoDuration"; readonly maxVideoDuration: number }
  | { readonly _tag: "ResetSession" }
  | { readonly _tag: "ClearError" };

export const createInitialFootageState = (
  shots: ReadonlyArray<Shot> = [],
  maxVideoDuration = 3600,
  minDurations: CategoryMinDurations = DEFAULT_MIN_DURATIONS,
): FootageState => ({
  shots,
  selectedShotId: shots.at(0)?.id ?? null,
  minDurations,
  maxVideoDuration,
  errorMessage: null,
});

const mapShot = (
  shots: ReadonlyArray<Shot>,
  shotId: ShotId,
  fn: (s: Shot) => Shot,
): ReadonlyArray<Shot> => shots.map((s) => (s.id === shotId ? fn(s) : s));

export const footageReducer = (state: FootageState, action: FootageAction): FootageState =>
  Match.value(action).pipe(
    Match.tag("SetShots", ({ shots }) => ({
      ...state,
      shots,
      selectedShotId: shots.at(0)?.id ?? null,
      errorMessage: null,
    })),
    Match.tag("SelectShot", ({ shotId }) => ({
      ...state,
      selectedShotId: shotId,
    })),
    Match.tag("ClassifyShot", ({ shotId, category }) => ({
      ...state,
      shots: mapShot(state.shots, shotId, (s) => classifyShot(s, category, state.minDurations)),
      errorMessage: null,
    })),
    Match.tag("SplitShot", ({ shotId, targetSec, newSecondId }) =>
      Result.match(splitShotAt(state.shots, shotId, targetSec, newSecondId, state.minDurations), {
        onFailure: (err) => ({ ...state, errorMessage: err.message }),
        onSuccess: ([nextShots, nextSelected]) => ({
          ...state,
          shots: nextShots,
          selectedShotId: nextSelected,
          errorMessage: null,
        }),
      }),
    ),
    Match.tag("MergeWithNext", ({ shotId }) =>
      Result.match(mergeShotWithNext(state.shots, shotId, state.minDurations), {
        onFailure: (err) => ({ ...state, errorMessage: err.message }),
        onSuccess: ([nextShots, nextSelected]) => ({
          ...state,
          shots: nextShots,
          selectedShotId: nextSelected,
          errorMessage: null,
        }),
      }),
    ),
    Match.tag("TrimShot", ({ shotId, begin, end }) => ({
      ...state,
      shots: mapShot(state.shots, shotId, (s) =>
        trimShot(s, begin, end, state.maxVideoDuration, state.minDurations),
      ),
      errorMessage: null,
    })),
    Match.tag("ToggleFlip", ({ shotId }) => ({
      ...state,
      shots: mapShot(state.shots, shotId, toggleShotFlip),
    })),
    Match.tag("ToggleFlipLock", ({ shotId }) => ({
      ...state,
      shots: mapShot(state.shots, shotId, toggleShotFlipLock),
    })),
    Match.tag("SetSpeed", ({ shotId, speed }) => ({
      ...state,
      shots: mapShot(state.shots, shotId, (s) => setShotSpeed(s, speed)),
    })),
    Match.tag("SetZoom", ({ shotId, zoom }) => ({
      ...state,
      shots: mapShot(state.shots, shotId, (s) => setShotZoom(s, zoom)),
    })),
    Match.tag("RenameShot", ({ shotId, label }) => ({
      ...state,
      shots: mapShot(state.shots, shotId, (s) => ({ ...s, label })),
    })),
    Match.tag("AddManualShot", ({ shot }) => ({
      ...state,
      shots: [...state.shots, shot],
      selectedShotId: shot.id,
      errorMessage: null,
    })),
    Match.tag("SetMinDuration", ({ category, seconds }) => {
      const clamped = Math.max(0.5, Math.min(60, Number(seconds.toFixed(1))));
      const nextMinDurations: CategoryMinDurations = {
        ...state.minDurations,
        [category]: clamped as CategoryMinDurations[typeof category],
      };
      return {
        ...state,
        minDurations: nextMinDurations,
        shots: state.shots.map((s) =>
          s._tag === "ClassifiedShot" && s.category === category
            ? applyMinDuration(s, nextMinDurations)
            : s,
        ),
      };
    }),
    Match.tag("DeleteShot", ({ shotId }) => {
      const nextShots = deleteShot(state.shots, shotId);
      return {
        ...state,
        shots: nextShots,
        selectedShotId:
          state.selectedShotId === shotId ? (nextShots.at(0)?.id ?? null) : state.selectedShotId,
      };
    }),
    Match.tag("SetMaxVideoDuration", ({ maxVideoDuration }) => ({
      ...state,
      maxVideoDuration: Math.max(0.5, maxVideoDuration),
    })),
    Match.tag("ResetSession", () => ({
      ...state,
      shots: [],
      selectedShotId: null,
      errorMessage: null,
    })),
    Match.tag("ClearError", () => ({
      ...state,
      errorMessage: null,
    })),
    Match.exhaustive,
  );
