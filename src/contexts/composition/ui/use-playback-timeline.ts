"use client";

import { Option } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";

import { resolveSlotAtTime } from "../domain/timeline";
import type { PlannedSlot } from "../domain/types";

export interface UsePlaybackTimelineOptions {
  readonly slots: ReadonlyArray<PlannedSlot>;
  readonly totalDuration: number;
  readonly onPositionChange?: (timelineSec: number, slotIndex: number) => void;
}

export function usePlaybackTimeline({
  slots,
  totalDuration,
  onPositionChange,
}: UsePlaybackTimelineOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelineSec, setTimelineSec] = useState(0);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);

  const timelineRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  const seekTo = useCallback(
    (targetSec: number) => {
      const resolved = resolveSlotAtTime(slots, targetSec, totalDuration);
      if (Option.isNone(resolved)) {
        timelineRef.current = 0;
        setTimelineSec(0);
        setActiveSlotIndex(0);
        return null;
      }
      const pos = resolved.value;
      timelineRef.current = pos.clampedTimelineSec;
      setTimelineSec(pos.clampedTimelineSec);
      setActiveSlotIndex(pos.slotIndex);
      onPositionChange?.(pos.clampedTimelineSec, pos.slotIndex);
      return pos;
    },
    [slots, totalDuration, onPositionChange],
  );

  const pause = useCallback(() => {
    setIsPlaying(false);
    lastTickRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (slots.length === 0) return;
    if (timelineRef.current >= totalDuration - 0.05) {
      seekTo(0);
    }
    setIsPlaying(true);
  }, [slots.length, totalDuration, seekTo]);

  useEffect(() => {
    if (!isPlaying) return;

    const tick = (now: number) => {
      const prev = lastTickRef.current ?? now;
      lastTickRef.current = now;
      const dt = Math.min(0.1, Math.max(0, (now - prev) / 1000));
      const nextSec = timelineRef.current + dt;

      if (nextSec >= totalDuration) {
        seekTo(totalDuration);
        setIsPlaying(false);
        lastTickRef.current = null;
        return;
      }

      seekTo(nextSec);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTickRef.current = null;
    };
  }, [isPlaying, totalDuration, seekTo]);

  return {
    isPlaying,
    timelineSec,
    activeSlotIndex,
    play,
    pause,
    seekTo,
  };
}
