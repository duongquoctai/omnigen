"use server";

import { Effect, Layer, ManagedRuntime, Option } from "effect";

import { makeAction } from "@/platform/run";
import { AppLayer } from "@/platform/runtime";

import { DriveMediaGatewayLive } from "../adapters/drive-gateway";
import {
  ClipLibraryRepoLive,
  PlannedVideoRepoLive,
  RenderedTuplesQueryLive,
} from "../adapters/library-repo";
import { VoiceLibraryRepoLive } from "../adapters/voice-repo";
import {
  ClearCategoryInput,
  clearCategoryPool,
  ingestDriveLinks,
  IngestDriveLinksInput,
  ingestDriveVoices,
  IngestDriveVoicesInput,
  removeClipFromLibrary,
  RemoveClipInput,
  RemoveVoiceInput,
  removeVoiceTrack,
} from "../workflows/ingest-drive-links";
import { planMix, PlanMixInput } from "../workflows/plan-mix";

const CompositionLayer = Layer.mergeAll(
  AppLayer,
  DriveMediaGatewayLive,
  ClipLibraryRepoLive.pipe(Layer.provide(AppLayer)),
  VoiceLibraryRepoLive.pipe(Layer.provide(AppLayer)),
  RenderedTuplesQueryLive.pipe(Layer.provide(AppLayer)),
  PlannedVideoRepoLive,
);

const compositionRuntime = ManagedRuntime.make(CompositionLayer);

export const ingestDriveLinksAction = makeAction(
  IngestDriveLinksInput,
  (input) =>
    Effect.map(ingestDriveLinks(input), (res) => ({
      addedCount: res.addedCount,
      skippedUrls: res.skippedUrls,
      clips: res.clips.map((c) => ({
        ...c,
        contentHash: Option.getOrNull(c.contentHash),
      })),
    })),
  compositionRuntime,
);

export const ingestDriveVoicesAction = makeAction(
  IngestDriveVoicesInput,
  (input) =>
    Effect.map(ingestDriveVoices(input), (res) => ({
      addedCount: res.addedCount,
      skippedUrls: res.skippedUrls,
      voices: res.voices.map((v) => ({
        ...v,
        localPath: Option.getOrNull(v.localPath),
      })),
    })),
  compositionRuntime,
);

export const removeClipAction = makeAction(
  RemoveClipInput,
  removeClipFromLibrary,
  compositionRuntime,
);

export const clearCategoryAction = makeAction(
  ClearCategoryInput,
  clearCategoryPool,
  compositionRuntime,
);

export const removeVoiceAction = makeAction(RemoveVoiceInput, removeVoiceTrack, compositionRuntime);

export const planMixAction = makeAction(
  PlanMixInput,
  (input) =>
    Effect.map(planMix(input), (res) => ({
      ...res,
      videos: res.videos.map((v) => ({
        ...v,
        voiceId: Option.getOrNull(v.voiceId),
      })),
    })),
  compositionRuntime,
);
