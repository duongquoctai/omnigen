import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyTrimDrag, computeTrimWindow, roundToStep } from "../trim";

describe("footage/domain/trim", () => {
  it("computes trim window percentages and ghost raw markers", () => {
    const m = computeTrimWindow({
      videoBegin: 10,
      videoEnd: 15,
      totalDuration: 30,
      rawBegin: 9,
      rawEnd: 16,
      contextPadding: 6,
    });
    expect(m.windowStart).toBe(3);
    expect(m.windowEnd).toBe(22);
    expect(m.widthPercent).toBeCloseTo(m.endPercent - m.beginPercent, 5);
    expect(m.rawBeginPercent).not.toBeNull();
    expect(m.rawEndPercent).not.toBeNull();
  });

  it("applies begin, end, and middle drags while respecting bounds", () => {
    expect(
      applyTrimDrag({
        handle: "begin",
        deltaSec: 2,
        initialBegin: 4,
        initialEnd: 10,
        safeTotal: 20,
        minClipDuration: 0.2,
        step: 0.1,
      }),
    ).toEqual({ begin: 6, end: 10 });

    expect(
      applyTrimDrag({
        handle: "end",
        deltaSec: 15,
        initialBegin: 4,
        initialEnd: 10,
        safeTotal: 20,
        minClipDuration: 0.2,
        step: 0.1,
      }),
    ).toEqual({ begin: 4, end: 20 });

    expect(
      applyTrimDrag({
        handle: "middle",
        deltaSec: 3,
        initialBegin: 2,
        initialEnd: 6,
        safeTotal: 20,
        minClipDuration: 0.2,
        step: 0.1,
      }),
    ).toEqual({ begin: 5, end: 9 });
  });

  it("property: applyTrimDrag always stays within [0, safeTotal] and maintains minClipDuration", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("begin" as const, "end" as const, "middle" as const),
        fc.double({ min: -50, max: 50, noNaN: true }),
        (handle, deltaSec) => {
          const next = applyTrimDrag({
            handle,
            deltaSec,
            initialBegin: 5,
            initialEnd: 12,
            safeTotal: 20,
            minClipDuration: 0.5,
            step: 0.1,
          });
          expect(next.begin).toBeGreaterThanOrEqual(0);
          expect(next.end).toBeLessThanOrEqual(20);
          expect(next.end - next.begin).toBeGreaterThanOrEqual(0.49);
          expect(roundToStep(1.23, 0.1)).toBe(1.2);
        },
      ),
    );
  });
});
