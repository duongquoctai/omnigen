import { Option, Result } from "effect";

import {
  type MediaUrl,
  Seconds,
  SHOT_CATEGORY_VALUES,
  type ShotCategory,
  type SourceVideoId,
  type VoiceId,
} from "@/contexts/shared-kernel";

import { LibraryIncomplete } from "./errors";
import type {
  Clip,
  ClipLibrary,
  CompositionTuple,
  DiversityRules,
  PlannedSlot,
  PlannedVideo,
  PlannedVideoId,
  SyncMode,
  VoiceClip,
} from "./types";

export const CATEGORY_ORDER = SHOT_CATEGORY_VALUES;

type FingerprintTuple = readonly [string, string, string, string, string];
type ClipTuple = readonly [Clip, Clip, Clip, Clip, Clip];

/**
 * Pure stateless Mulberry32 step: returns [randomFloatIn0to1, nextSeedState].
 */
export const nextSeededRandom = (state: number): readonly [number, number] => {
  const nextState = (state + 0x6d2b79f5) | 0;
  const t1 = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
  const t2 = t1 ^ (t1 + Math.imul(t1 ^ (t1 >>> 7), t1 | 61));
  const value = ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
  return [value, nextState >>> 0] as const;
};

export const isSameFingerprint = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  if (a === b) return true;
  const cleanA = a.replace(/^drive_[^_]+_/, "").replace(/^gdrive:/, "");
  const cleanB = b.replace(/^drive_[^_]+_/, "").replace(/^gdrive:/, "");
  return cleanA === cleanB;
};

export const computeFingerprintHamming = (
  tupleA: FingerprintTuple,
  tupleB: FingerprintTuple,
): number =>
  tupleA.reduce(
    (diff, val, idx) => (isSameFingerprint(val, tupleB[idx] ?? "") ? diff : diff + 1),
    0,
  );

export const getClipFingerprint = (clip: Clip): string => {
  if (Option.isSome(clip.contentHash)) {
    return `hash:${clip.contentHash.value}`;
  }
  if (clip.source._tag === "DriveClip") {
    return `gdrive:${clip.source.fileId}`;
  }
  if (clip.id.startsWith("drive_")) {
    const parts = clip.id.split("_");
    const third = parts.at(2);
    if (parts.length >= 3 && third) {
      return `gdrive:${third}`;
    }
  }
  return clip.id;
};

export interface PlannerOutput {
  readonly tuples: ReadonlyArray<ClipTuple>;
  readonly maxPossibleCombinations: number;
  readonly categoryCounts: Readonly<Record<ShotCategory, number>>;
  readonly clipUsageCounts: Readonly<Record<string, number>>;
  readonly minPairwiseHamming: number;
  readonly warnings: ReadonlyArray<string>;
}

const getClipMediaUrl = (clip: Clip): MediaUrl => {
  switch (clip.source._tag) {
    case "LocalClip":
      return clip.source.localUrl;
    case "DriveClip":
      return clip.source.streamUrl;
    case "FromShotClip":
      return clip.source.localUrl;
  }
};

const toFingerprintTuple = (tuple: ClipTuple): FingerprintTuple => [
  getClipFingerprint(tuple[0]),
  getClipFingerprint(tuple[1]),
  getClipFingerprint(tuple[2]),
  getClipFingerprint(tuple[3]),
  getClipFingerprint(tuple[4]),
];

const parseHistoryTuples = (historyKeys: ReadonlyArray<string>): ReadonlyArray<FingerprintTuple> =>
  historyKeys.flatMap((key) => {
    if (!key) return [];
    const parts = key.split("|");
    if (parts.length !== 5) return [];
    const [a, b, c, d, e] = parts;
    if (!a || !b || !c || !d || !e) return [];
    return [[a, b, c, d, e] as const];
  });

export const ensureCompleteLibrary = (
  library: ClipLibrary,
): Result.Result<ClipLibrary, LibraryIncomplete> => {
  const missing = CATEGORY_ORDER.filter((cat) => library[cat].length === 0);
  if (missing.length > 0) {
    return Result.fail(
      new LibraryIncomplete({
        missingCategories: missing,
        message: `Thư viện thiếu clip ở các nhóm: ${missing.join(", ")}`,
      }),
    );
  }
  return Result.succeed(library);
};

interface SearchState {
  readonly rngState: number;
  readonly selected: ReadonlyArray<ClipTuple>;
  readonly selectedFps: ReadonlyArray<FingerprintTuple>;
  readonly usage: Readonly<Record<string, number>>;
  readonly attempts: number;
  readonly consecutiveFailures: number;
  readonly usageSlack: number;
  readonly backtracks: number;
}

export const planDiverseTuples = (
  library: ClipLibrary,
  rules: DiversityRules,
  historyTupleKeys: ReadonlyArray<string> = [],
): Result.Result<PlannerOutput, LibraryIncomplete> => {
  const checked = ensureCompleteLibrary(library);
  if (Result.isFailure(checked)) {
    return Result.fail(checked.failure);
  }

  const categoryCounts: Readonly<Record<ShotCategory, number>> = {
    open: library.open.length,
    product: library.product.length,
    texture: library.texture.length,
    apply: library.apply.length,
    end: library.end.length,
  };

  const maxPossibleCombinations =
    library.open.length *
    library.product.length *
    library.texture.length *
    library.apply.length *
    library.end.length;

  const targetN = Math.min(rules.targetCount, maxPossibleCombinations);
  const minHamming = Math.max(2, Math.min(5, rules.minHammingDistance));
  const minPoolLen = Math.min(
    library.open.length,
    library.product.length,
    library.texture.length,
    library.apply.length,
    library.end.length,
  );
  const minReqFreq = Math.ceil(targetN / minPoolLen);
  const maxFreq = Math.max(minReqFreq, Math.max(1, rules.maxShotFrequency));
  const parsedHistory = parseHistoryTuples(historyTupleKeys);
  const maxAttempts = 50_000;
  const maxBacktracks = 100;

  const pickCandidate = (
    catIdx: number,
    rngState: number,
    usage: Readonly<Record<string, number>>,
    usageSlack: number,
    acc: ReadonlyArray<Clip>,
    allSingle: boolean,
  ):
    | { readonly ok: false; readonly rngState: number }
    | {
        readonly ok: true;
        readonly tuple: ClipTuple;
        readonly rngState: number;
        readonly allSingle: boolean;
      } => {
    const cat = CATEGORY_ORDER.at(catIdx);
    if (!cat) {
      const c0 = acc.at(0);
      const c1 = acc.at(1);
      const c2 = acc.at(2);
      const c3 = acc.at(3);
      const c4 = acc.at(4);
      if (!c0 || !c1 || !c2 || !c3 || !c4) {
        return { ok: false, rngState };
      }
      return { ok: true, tuple: [c0, c1, c2, c3, c4] as const, rngState, allSingle };
    }

    const eligible = library[cat].filter((it) => (usage[it.id] ?? 0) < maxFreq);
    if (eligible.length === 0) {
      return { ok: false, rngState };
    }

    const minUsage = eligible.reduce((min, it) => Math.min(min, usage[it.id] ?? 0), Infinity);
    const best = eligible.filter((it) => (usage[it.id] ?? 0) <= minUsage + usageSlack);
    const [randVal, nextRng] = nextSeededRandom(rngState);
    const chosen = best.at(Math.floor(randVal * best.length)) ?? eligible.at(0);
    if (!chosen) {
      return { ok: false, rngState: nextRng };
    }

    return pickCandidate(
      catIdx + 1,
      nextRng,
      usage,
      usageSlack,
      [...acc, chosen],
      allSingle && best.length <= 1,
    );
  };

  const step = (state: SearchState): SearchState => {
    if (state.selected.length >= targetN || state.attempts >= maxAttempts) {
      return state;
    }

    const picked = pickCandidate(0, state.rngState, state.usage, state.usageSlack, [], true);
    if (!picked.ok) {
      return state;
    }

    const cand = picked.tuple;
    const candFps = toFingerprintTuple(cand);

    const exceedsFreq = cand.some((c) => (state.usage[c.id] ?? 0) + 1 > maxFreq);
    const violatesHistory =
      !exceedsFreq && parsedHistory.some((hist) => computeFingerprintHamming(candFps, hist) < 2);
    const violatesHamming =
      !exceedsFreq &&
      !violatesHistory &&
      state.selectedFps.some((prev) => computeFingerprintHamming(candFps, prev) < minHamming);

    if (exceedsFreq || violatesHistory || violatesHamming) {
      const nextFailures = state.consecutiveFailures + 1;
      if (picked.allSingle || nextFailures >= 30) {
        if (
          state.usageSlack === 0 &&
          state.selected.length > 0 &&
          state.backtracks < maxBacktracks
        ) {
          const lastTuple = state.selected.at(-1);
          const decremented = lastTuple
            ? lastTuple.reduce<Readonly<Record<string, number>>>(
                (u, c) => ({ ...u, [c.id]: Math.max(0, (u[c.id] ?? 0) - 1) }),
                state.usage,
              )
            : state.usage;
          return step({
            ...state,
            rngState: picked.rngState,
            selected: state.selected.slice(0, -1),
            selectedFps: state.selectedFps.slice(0, -1),
            usage: decremented,
            attempts: state.attempts + 1,
            consecutiveFailures: 0,
            backtracks: state.backtracks + 1,
          });
        }
        if (state.usageSlack < maxFreq) {
          return step({
            ...state,
            rngState: picked.rngState,
            attempts: state.attempts + 1,
            usageSlack: state.usageSlack + 1,
            consecutiveFailures: 0,
          });
        }
        if (nextFailures >= 500) {
          return { ...state, rngState: picked.rngState, attempts: state.attempts + 1 };
        }
      }
      return step({
        ...state,
        rngState: picked.rngState,
        attempts: state.attempts + 1,
        consecutiveFailures: nextFailures,
      });
    }

    const nextUsage = cand.reduce<Readonly<Record<string, number>>>(
      (u, c) => ({ ...u, [c.id]: (u[c.id] ?? 0) + 1 }),
      state.usage,
    );

    return step({
      ...state,
      rngState: picked.rngState,
      selected: [...state.selected, cand],
      selectedFps: [...state.selectedFps, candFps],
      usage: nextUsage,
      attempts: state.attempts + 1,
      consecutiveFailures: 0,
      usageSlack: 0,
    });
  };

  const finalState = step({
    rngState: (rules.seed || 42) >>> 0,
    selected: [],
    selectedFps: [],
    usage: {},
    attempts: 0,
    consecutiveFailures: 0,
    usageSlack: 0,
    backtracks: 0,
  });

  const minPairwiseHamming =
    finalState.selectedFps.length <= 1
      ? 5
      : finalState.selectedFps.reduce((minD, fpA, i) => {
          const innerMin = finalState.selectedFps
            .slice(i + 1)
            .reduce((m, fpB) => Math.min(m, computeFingerprintHamming(fpA, fpB)), 5);
          return Math.min(minD, innerMin);
        }, 5);

  const warnings =
    finalState.selected.length < targetN
      ? [
          `Đã dừng ở ${String(finalState.selected.length)}/${String(targetN)} video do ràng buộc độ đa dạng (Min Hamming = ${String(minHamming)}, Max lặp shot = ${String(maxFreq)}).`,
        ]
      : [];

  return Result.succeed({
    tuples: finalState.selected,
    maxPossibleCombinations,
    categoryCounts,
    clipUsageCounts: finalState.usage,
    minPairwiseHamming,
    warnings,
  });
};

export const tupleToKey = (tuple: CompositionTuple): string =>
  `${tuple.open}|${tuple.product}|${tuple.texture}|${tuple.apply}|${tuple.end}`;

export const clipsToTupleKey = (clips: ClipTuple): string =>
  clips.map((c) => getClipFingerprint(c)).join("|");

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Balanced round-robin voice assignment + unique pairing with OPEN hook + repeat penalty,
 * identical to legacy `/api/plan-mix`.
 */
export const assignVoicesToTuples = (
  tuples: ReadonlyArray<ClipTuple>,
  voices: ReadonlyArray<VoiceClip>,
  enableVoice: boolean,
): ReadonlyArray<Option.Option<VoiceClip>> => {
  if (!enableVoice || voices.length === 0) {
    return tuples.map(() => Option.none());
  }

  interface VoiceAcc {
    readonly assigned: ReadonlyArray<Option.Option<VoiceClip>>;
    readonly voiceUsageCounts: Readonly<Record<string, number>>;
    readonly openVoicePairCounts: Readonly<Record<string, number>>;
    readonly lastVoiceId: string | null;
  }

  const pickBestVoice = (
    index: number,
    openId: string,
    acc: VoiceAcc,
    vIdx: number,
    bestVoice: VoiceClip,
    bestScore: number,
  ): VoiceClip => {
    if (vIdx >= voices.length) {
      return bestVoice;
    }
    const candidate = voices.at((index + vIdx) % voices.length);
    if (!candidate) {
      return pickBestVoice(index, openId, acc, vIdx + 1, bestVoice, bestScore);
    }
    const vUse = acc.voiceUsageCounts[candidate.id] ?? 0;
    const pairKey = `${openId}|${candidate.id}`;
    const pairUse = acc.openVoicePairCounts[pairKey] ?? 0;
    const repeatPenalty = voices.length > 1 && candidate.id === acc.lastVoiceId ? 200 : 0;
    const score = vUse * 100 + pairUse * 60 + repeatPenalty;
    const isBetter = score < bestScore;
    return pickBestVoice(
      index,
      openId,
      acc,
      vIdx + 1,
      isBetter ? candidate : bestVoice,
      isBetter ? score : bestScore,
    );
  };

  const initialAcc: VoiceAcc = {
    assigned: [],
    voiceUsageCounts: {},
    openVoicePairCounts: {},
    lastVoiceId: null,
  };

  return tuples.reduce<VoiceAcc>((acc, tuple, index) => {
    const fallback = voices.at(index % voices.length) ?? voices.at(0);
    if (!fallback) {
      return { ...acc, assigned: [...acc.assigned, Option.none()] };
    }
    const openId = tuple[0].id;
    const chosen = pickBestVoice(index, openId, acc, 0, fallback, Infinity);
    const pairKey = `${openId}|${chosen.id}`;
    return {
      assigned: [...acc.assigned, Option.some(chosen)],
      voiceUsageCounts: {
        ...acc.voiceUsageCounts,
        [chosen.id]: (acc.voiceUsageCounts[chosen.id] ?? 0) + 1,
      },
      openVoicePairCounts: {
        ...acc.openVoicePairCounts,
        [pairKey]: (acc.openVoicePairCounts[pairKey] ?? 0) + 1,
      },
      lastVoiceId: chosen.id,
    };
  }, initialAcc).assigned;
};

export const buildPlannedVideo = (params: {
  readonly id: PlannedVideoId;
  readonly name: string;
  readonly clips: ClipTuple;
  readonly voice: Option.Option<VoiceClip>;
  readonly syncMode: SyncMode;
  readonly targetOutputDuration: number;
  readonly preserveOriginalClips?: boolean | undefined;
}): PlannedVideo => {
  const {
    id,
    name,
    clips,
    voice,
    syncMode,
    targetOutputDuration,
    preserveOriginalClips = false,
  } = params;

  const rawTotal = clips.reduce((sum, c) => sum + Math.max(0.1, c.duration), 0);
  const scaleFactor = preserveOriginalClips
    ? 1
    : rawTotal > 0 && targetOutputDuration > 0
      ? Math.min(4, Math.max(0.25, rawTotal / targetOutputDuration))
      : 1;

  const makeSlot = (clip: Clip, startSec: number): PlannedSlot => {
    const adjustedSpeed = round3(scaleFactor);
    const dur = round3(Math.max(0.1, clip.duration / adjustedSpeed));
    const enterBegin = round3(startSec) as Seconds;
    const exitEnd = round3(enterBegin + dur) as Seconds;
    return {
      category: clip.category,
      clipId: clip.id,
      clipLabel: clip.name,
      sourceVideoId: (clip.source._tag === "FromShotClip"
        ? clip.source.folderId
        : clip.id) as unknown as SourceVideoId,
      videoBegin: 0 as Seconds,
      videoEnd: round3(clip.duration) as Seconds,
      originalVideoEnd: round3(clip.duration) as Seconds,
      enterBegin,
      exitEnd,
      localUrl: getClipMediaUrl(clip),
      speed: adjustedSpeed,
      flipH: false,
    };
  };

  const s0 = makeSlot(clips[0], 0);
  const s1 = makeSlot(clips[1], s0.exitEnd);
  const s2 = makeSlot(clips[2], s1.exitEnd);
  const s3 = makeSlot(clips[3], s2.exitEnd);
  const s4 = makeSlot(clips[4], s3.exitEnd);

  const totalVisualDuration = s4.exitEnd;
  const voiceDur = Option.isSome(voice) ? voice.value.duration : totalVisualDuration;
  const finalDuration = round3(
    Math.max(
      0.5,
      syncMode === "voice_master"
        ? voiceDur
        : syncMode === "shorter_wins"
          ? Math.min(totalVisualDuration, voiceDur)
          : totalVisualDuration,
    ),
  ) as Seconds;

  const tuple: CompositionTuple = {
    open: clips[0].id,
    product: clips[1].id,
    texture: clips[2].id,
    apply: clips[3].id,
    end: clips[4].id,
  };
  return {
    id,
    name,
    tupleKey: clipsToTupleKey(clips),
    tuple,
    slots: [s0, s1, s2, s3, s4],
    totalVisualDuration,
    finalDuration,
    voiceId: Option.map(voice, (v) => v.id),
    syncMode,
  };
};

export interface PlannedSlotEdits {
  readonly videoBegin?: number | undefined;
  readonly videoEnd?: number | undefined;
  readonly speed?: number | undefined;
  readonly flipH?: boolean | undefined;
}

export const recalculatePlannedVideo = (params: {
  readonly video: PlannedVideo;
  readonly slotIndex: number;
  readonly edits: PlannedSlotEdits;
  readonly nextVoiceId?: Option.Option<VoiceId> | undefined;
}): PlannedVideo => {
  const { video, slotIndex, edits, nextVoiceId } = params;
  const editedSlots = video.slots.map((slot, idx) => {
    if (idx !== slotIndex) return slot;
    const clampedBegin = Math.max(0, edits.videoBegin ?? slot.videoBegin);
    const maxEnd = slot.originalVideoEnd ?? slot.videoEnd;
    const rawEnd = edits.videoEnd ?? slot.videoEnd;
    const cappedEnd = maxEnd > 0 ? Math.min(maxEnd, rawEnd) : rawEnd;
    const clampedEnd =
      cappedEnd <= clampedBegin + 0.2 ? round3(clampedBegin + 0.2) : round3(cappedEnd);
    const clampedSpeed = round3(Math.min(5, Math.max(0.1, edits.speed ?? slot.speed)));
    return {
      ...slot,
      videoBegin: round3(clampedBegin) as Seconds,
      videoEnd: clampedEnd as Seconds,
      speed: clampedSpeed,
      flipH: edits.flipH ?? slot.flipH,
    };
  });

  const recomputed = editedSlots.reduce<{
    readonly cursor: number;
    readonly slots: ReadonlyArray<PlannedSlot>;
  }>(
    (acc, slot) => {
      const slotDur = round3(
        Math.max(0.1, slot.videoEnd - slot.videoBegin) / Math.max(0.1, slot.speed || 1),
      );
      const enterBegin = round3(acc.cursor) as Seconds;
      const exitEnd = round3(acc.cursor + slotDur) as Seconds;
      return { cursor: exitEnd, slots: [...acc.slots, { ...slot, enterBegin, exitEnd }] };
    },
    { cursor: 0, slots: [] },
  );

  const first = recomputed.slots.at(0) ?? video.slots[0];
  const lastSlot = recomputed.slots.at(-1) ?? first;
  const finalDuration = round3(Math.max(0.5, lastSlot.exitEnd)) as Seconds;
  return {
    ...video,
    slots: [first, ...recomputed.slots.slice(1)],
    totalVisualDuration: finalDuration,
    finalDuration,
    voiceId: nextVoiceId ?? video.voiceId,
  };
};
