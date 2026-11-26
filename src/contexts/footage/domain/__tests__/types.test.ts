import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { DraftShot, Shot, Speed, TimeRange, ZoomDepth } from "../types";

describe("footage domain types", () => {
  it("enforces Speed between 0.1 and 10", () => {
    const decodeSpeed = Schema.decodeUnknownSync(Speed);
    expect(decodeSpeed(0.1)).toBe(0.1);
    expect(decodeSpeed(1)).toBe(1);
    expect(decodeSpeed(10)).toBe(10);
    expect(() => decodeSpeed(0.05)).toThrow();
    expect(() => decodeSpeed(10.5)).toThrow();
  });

  it("enforces ZoomDepth between 1 and 10", () => {
    const decodeZoom = Schema.decodeUnknownSync(ZoomDepth);
    expect(decodeZoom(1.2)).toBe(1.2);
    expect(() => decodeZoom(0.9)).toThrow();
    expect(() => decodeZoom(11)).toThrow();
  });

  it("enforces TimeRange end > begin", () => {
    const decodeRange = Schema.decodeUnknownSync(TimeRange);
    expect(decodeRange({ begin: 1, end: 4 })).toEqual({ begin: 1, end: 4 });
    expect(() => decodeRange({ begin: 4, end: 4 })).toThrow();
    expect(() => decodeRange({ begin: 5, end: 2 })).toThrow();
  });

  it("decodes DraftShot and ClassifiedShot via Shot union", () => {
    const decodeShot = Schema.decodeUnknownSync(Shot);
    const base = {
      id: "shot_1",
      sourceVideoId: "src_1",
      label: "Hook",
      range: { begin: 0, end: 3.5 },
      detectedRange: { begin: 0, end: 3.5 },
      contentHash: null,
      edits: {
        flip: { _tag: "Unflipped", locked: false },
        speed: 1,
        zoom: { _tag: "NoZoom" },
        crop: null,
        transition: { _tag: "NoTransition" },
      },
    };

    const draft = decodeShot({ _tag: "DraftShot", ...base });
    expect(draft._tag).toBe("DraftShot");
    expect(Schema.is(DraftShot)(draft)).toBe(true);

    const classified = decodeShot({ _tag: "ClassifiedShot", ...base, category: "open" });
    expect(classified._tag).toBe("ClassifiedShot");
  });
});
