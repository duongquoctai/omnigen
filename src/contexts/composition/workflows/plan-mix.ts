import { Effect, Option, Result, Schema } from "effect";

import { FolderId } from "@/contexts/shared-kernel";

import { NotEnoughCombinations } from "../domain/errors";
import type { MixPlanned } from "../domain/events";
import { assignVoicesToTuples, buildPlannedVideo, planDiverseTuples } from "../domain/planner";
import { DiversityRules, type PlannedVideoId, SyncMode } from "../domain/types";
import { ClipLibraryRepo, PlannedVideoRepo, RenderedTuplesQuery, VoiceLibraryRepo } from "./ports";

export const PlanMixInput = Schema.Struct({
  folderId: FolderId,
  rules: DiversityRules,
  syncMode: SyncMode,
  enableVoice: Schema.optional(Schema.Boolean),
  clipNamePrefix: Schema.optional(Schema.String),
  preserveOriginalClips: Schema.optional(Schema.Boolean),
});
export type PlanMixInput = typeof PlanMixInput.Type;

export const planMix = (input: PlanMixInput) =>
  Effect.gen(function* () {
    const libraryRepo = yield* ClipLibraryRepo;
    const voiceRepo = yield* VoiceLibraryRepo;
    const tuplesQuery = yield* RenderedTuplesQuery;
    const plannedRepo = yield* PlannedVideoRepo;

    const library = yield* libraryRepo.get(input.folderId);
    const voices = yield* voiceRepo.list(input.folderId);
    const historyTuples = yield* tuplesQuery.forFolder(input.folderId);

    const plannedResult = planDiverseTuples(library, input.rules, historyTuples);
    if (Result.isFailure(plannedResult)) {
      return yield* Effect.fail(plannedResult.failure);
    }

    const { tuples } = plannedResult.success;
    if (tuples.length === 0) {
      return yield* Effect.fail(
        new NotEnoughCombinations({
          requested: input.rules.targetCount,
          generated: 0,
          message: "Không thể tạo tổ hợp nào thoả mãn ràng buộc đa dạng và lịch sử đã render.",
        }),
      );
    }

    const enableVoice = input.enableVoice ?? true;
    const prefix = input.clipNamePrefix?.trim() ?? "";
    const preserveOriginalClips = input.preserveOriginalClips ?? true;
    const assignedVoices = assignVoicesToTuples(tuples, voices, enableVoice);

    const videos = tuples.map((clips, idx) => {
      const voice = assignedVoices.at(idx) ?? Option.none();
      const name =
        prefix.length > 0 ? `${prefix} #${String(idx + 1)}` : `Video Remix #${String(idx + 1)}`;
      return buildPlannedVideo({
        id: `comp_${String(idx + 1)}_${String(input.rules.seed)}` as PlannedVideoId,
        name,
        clips,
        voice,
        syncMode: input.syncMode,
        targetOutputDuration: input.rules.targetOutputDuration,
        preserveOriginalClips,
      });
    });

    const first = videos.at(0);
    if (!first) {
      return yield* Effect.fail(
        new NotEnoughCombinations({
          requested: input.rules.targetCount,
          generated: 0,
          message: "Không có video nào được tạo.",
        }),
      );
    }

    const nonEmptyVideos = [first, ...videos.slice(1)] as const;
    yield* plannedRepo.replaceAll(input.folderId, nonEmptyVideos);

    return {
      _tag: "MixPlanned",
      folderId: input.folderId,
      videos: nonEmptyVideos,
    } satisfies MixPlanned;
  });
