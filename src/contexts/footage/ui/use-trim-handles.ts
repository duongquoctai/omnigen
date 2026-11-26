"use client";

import { useCallback, useRef, useState } from "react";

import { applyTrimDrag, computeTrimWindow, type TrimHandle } from "../domain/trim";

export interface UseTrimHandlesOptions {
  readonly videoBegin: number;
  readonly videoEnd: number;
  readonly totalDuration: number;
  readonly rawBegin?: number;
  readonly rawEnd?: number;
  readonly contextPadding?: number;
  readonly minClipDuration?: number;
  readonly step?: number;
  readonly onChange: (begin: number, end: number) => void;
  readonly onScrubStart?: () => void;
  readonly onScrubMove?: (sourceSec: number) => void;
  readonly onScrubEnd?: () => void;
}

export function useTrimHandles({
  videoBegin,
  videoEnd,
  totalDuration,
  rawBegin,
  rawEnd,
  contextPadding = 6.0,
  minClipDuration = 0.2,
  step = 0.1,
  onChange,
  onScrubStart,
  onScrubMove,
  onScrubEnd,
}: UseTrimHandlesOptions) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeHandle, setActiveHandle] = useState<TrimHandle | null>(null);

  const metrics = computeTrimWindow({
    videoBegin,
    videoEnd,
    totalDuration,
    ...(rawBegin !== undefined ? { rawBegin } : {}),
    ...(rawEnd !== undefined ? { rawEnd } : {}),
    contextPadding,
    minClipDuration,
  });

  const dragRef = useRef({
    startX: 0,
    initialBegin: metrics.safeBegin,
    initialEnd: metrics.safeEnd,
    trackWidth: 1,
    windowSpan: metrics.windowSpan,
  });

  const startDrag = useCallback(
    (clientX: number, handle: TrimHandle) => {
      const trackWidth = Math.max(1, trackRef.current?.getBoundingClientRect().width ?? 1);
      dragRef.current = {
        startX: clientX,
        initialBegin: metrics.safeBegin,
        initialEnd: metrics.safeEnd,
        trackWidth,
        windowSpan: metrics.windowSpan,
      };
      setActiveHandle(handle);
      onScrubStart?.();
    },
    [metrics.safeBegin, metrics.safeEnd, metrics.windowSpan, onScrubStart],
  );

  const moveDrag = useCallback(
    (clientX: number, handle: TrimHandle | null = activeHandle) => {
      if (!handle) return;
      const { startX, initialBegin, initialEnd, trackWidth, windowSpan } = dragRef.current;
      const deltaSec = ((clientX - startX) / trackWidth) * windowSpan;
      const next = applyTrimDrag({
        handle,
        deltaSec,
        initialBegin,
        initialEnd,
        safeTotal: metrics.safeTotal,
        minClipDuration,
        step,
      });
      onChange(next.begin, next.end);
      onScrubMove?.(handle === "end" ? next.end : next.begin);
    },
    [activeHandle, metrics.safeTotal, minClipDuration, step, onChange, onScrubMove],
  );

  const endDrag = useCallback(() => {
    setActiveHandle(null);
    onScrubEnd?.();
  }, [onScrubEnd]);

  return {
    trackRef,
    activeHandle,
    metrics,
    startDrag,
    moveDrag,
    endDrag,
  };
}
