"use client";

import type { FolderId } from "@/contexts/shared-kernel";

import type { PlannedVideo } from "../domain/types";

/**
 * In-memory client store keyed by FolderId to preserve planned video combinations
 * across SPA tab switches and client-side route transitions without losing state.
 * Intentionally resets on full browser reload / F5.
 */
const plannedVideosMemoryStore = new Map<FolderId, ReadonlyArray<PlannedVideo>>();

export const getStoredPlannedVideos = (folderId: FolderId): ReadonlyArray<PlannedVideo> =>
  plannedVideosMemoryStore.get(folderId) ?? [];

export const setStoredPlannedVideos = (
  folderId: FolderId,
  videos: ReadonlyArray<PlannedVideo>,
): void => {
  if (videos.length === 0) {
    plannedVideosMemoryStore.delete(folderId);
    return;
  }
  plannedVideosMemoryStore.set(folderId, videos);
};

export const clearStoredPlannedVideos = (folderId: FolderId): void => {
  plannedVideosMemoryStore.delete(folderId);
};
