import "server-only";

import { Layer, ManagedRuntime } from "effect";

import { AppConfigLive } from "./config";
import { HttpClientLive } from "./http/client";
import { SqlClientLive } from "./sql/client";
import { MediaStorageLive } from "./storage/media-storage";

export const AppLayer = Layer.mergeAll(
  AppConfigLive,
  SqlClientLive.pipe(Layer.provide(AppConfigLive)),
  HttpClientLive,
  MediaStorageLive,
);

export const appRuntime = ManagedRuntime.make(AppLayer);
