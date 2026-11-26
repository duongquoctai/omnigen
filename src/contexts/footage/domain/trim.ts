export type TrimHandle = "begin" | "end" | "middle";

export interface TrimWindowParams {
  readonly videoBegin: number;
  readonly videoEnd: number;
  readonly totalDuration: number;
  readonly rawBegin?: number;
  readonly rawEnd?: number;
  readonly contextPadding?: number;
  readonly minClipDuration?: number;
}

export interface TrimWindowMetrics {
  readonly safeTotal: number;
  readonly safeBegin: number;
  readonly safeEnd: number;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly windowSpan: number;
  readonly beginPercent: number;
  readonly endPercent: number;
  readonly widthPercent: number;
  readonly rawBeginPercent: number | null;
  readonly rawEndPercent: number | null;
}

export const roundToStep = (sec: number, step: number): number => {
  const safeStep = step > 0 ? step : 0.1;
  const factor = 1 / safeStep;
  return Math.round(sec * factor) / factor;
};

export const computeTrimWindow = (params: TrimWindowParams): TrimWindowMetrics => {
  const minClipDuration = params.minClipDuration ?? 0.2;
  const contextPadding = params.contextPadding ?? 6.0;

  const safeTotal = Math.max(0.5, params.totalDuration);
  const safeBegin = Math.max(0, Math.min(safeTotal - minClipDuration, params.videoBegin));
  const safeEnd = Math.max(
    safeBegin + minClipDuration,
    Math.min(safeTotal, params.videoEnd || safeTotal),
  );

  const hasRaw = params.rawBegin !== undefined && params.rawEnd !== undefined;
  const baseRawBegin = hasRaw ? params.rawBegin : safeBegin;
  const baseRawEnd = hasRaw ? params.rawEnd : safeEnd;

  const windowStart = Math.max(0, Math.min(baseRawBegin, safeBegin) - contextPadding);
  const windowEnd = Math.min(safeTotal, Math.max(baseRawEnd, safeEnd) + contextPadding);
  const windowSpan = Math.max(0.2, windowEnd - windowStart);

  const beginPercent = Math.max(0, Math.min(100, ((safeBegin - windowStart) / windowSpan) * 100));
  const endPercent = Math.max(0, Math.min(100, ((safeEnd - windowStart) / windowSpan) * 100));
  const widthPercent = Math.max(0, endPercent - beginPercent);

  const rawBeginPercent = hasRaw ? ((baseRawBegin - windowStart) / windowSpan) * 100 : null;
  const rawEndPercent = hasRaw ? ((baseRawEnd - windowStart) / windowSpan) * 100 : null;

  return {
    safeTotal,
    safeBegin,
    safeEnd,
    windowStart,
    windowEnd,
    windowSpan,
    beginPercent,
    endPercent,
    widthPercent,
    rawBeginPercent,
    rawEndPercent,
  };
};

export interface ApplyTrimDragParams {
  readonly handle: TrimHandle;
  readonly deltaSec: number;
  readonly initialBegin: number;
  readonly initialEnd: number;
  readonly safeTotal: number;
  readonly minClipDuration: number;
  readonly step: number;
}

export const applyTrimDrag = (
  params: ApplyTrimDragParams,
): { readonly begin: number; readonly end: number } => {
  const { handle, deltaSec, initialBegin, initialEnd, safeTotal, minClipDuration, step } = params;

  if (handle === "begin") {
    const nextBegin = roundToStep(
      Math.max(0, Math.min(initialEnd - minClipDuration, initialBegin + deltaSec)),
      step,
    );
    return { begin: nextBegin, end: roundToStep(initialEnd, step) };
  }

  if (handle === "end") {
    const nextEnd = roundToStep(
      Math.min(safeTotal, Math.max(initialBegin + minClipDuration, initialEnd + deltaSec)),
      step,
    );
    return { begin: roundToStep(initialBegin, step), end: nextEnd };
  }

  const clipSpan = initialEnd - initialBegin;
  const clampedBegin = Math.max(0, Math.min(safeTotal - clipSpan, initialBegin + deltaSec));
  const nextBegin = roundToStep(clampedBegin, step);
  const nextEnd = roundToStep(Math.min(safeTotal, nextBegin + clipSpan), step);
  return { begin: nextBegin, end: nextEnd };
};
