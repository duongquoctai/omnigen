"use server";

import { Effect, Layer, ManagedRuntime } from "effect";

import { makeAction } from "@/platform/run";
import { AppLayer } from "@/platform/runtime";

import { PythonSceneDetectorLive } from "../adapters/python-scene-detector";
import { PythonShotSlicerLive } from "../adapters/python-shot-slicer";
import { SessionFootageRepoLive, ShotIdGeneratorLive } from "../adapters/session-footage-repo";
import { shotToLegacyDto } from "../adapters/shot-dto";
import { detectScenes, DetectScenesInput } from "../workflows/detect-scenes";
import { PublishShotsInput, publishShotsToLibrary } from "../workflows/publish-shots";
import { sliceShots, SliceShotsInput } from "../workflows/slice-shots";

const FootageLayer = Layer.mergeAll(
  AppLayer,
  SessionFootageRepoLive.pipe(Layer.provide(AppLayer)),
  ShotIdGeneratorLive,
  PythonSceneDetectorLive.pipe(Layer.provide(AppLayer)),
  PythonShotSlicerLive.pipe(Layer.provide(AppLayer)),
);

const footageRuntime = ManagedRuntime.make(FootageLayer);

export const detectScenesAction = makeAction(
  DetectScenesInput,
  (input) =>
    Effect.map(detectScenes(input), (res) => ({
      totalScenes: res.totalScenes,
      totalDetected: res.totalDetected,
      slowMoCount: res.slowMoCount,
      shots: res.shots.map(shotToLegacyDto),
    })),
  footageRuntime,
);

export const sliceShotsAction = makeAction(SliceShotsInput, sliceShots, footageRuntime);

export const publishShotsAction = makeAction(
  PublishShotsInput,
  publishShotsToLibrary,
  footageRuntime,
);
