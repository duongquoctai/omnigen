import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ClipSource, DiversityRules, HammingDistance } from "../types";

describe("composition domain types", () => {
  it("enforces HammingDistance between 1 and 5", () => {
    const decode = Schema.decodeUnknownSync(HammingDistance);
    expect(decode(1)).toBe(1);
    expect(decode(5)).toBe(5);
    expect(() => decode(0)).toThrow();
    expect(() => decode(6)).toThrow();
    expect(() => decode(2.5)).toThrow();
  });

  it("decodes DiversityRules and rejects invalid targetCount", () => {
    const decodeRules = Schema.decodeUnknownSync(DiversityRules);
    const valid = decodeRules({
      targetCount: 5,
      targetOutputDuration: 20,
      minHammingDistance: 2,
      maxShotFrequency: 3,
      enableAutoVariantEdits: true,
      randomTransitionDuration: 0.4,
      seed: 42,
    });
    expect(valid.targetCount).toBe(5);
    expect(() => decodeRules({ ...valid, targetCount: 0 })).toThrow();
  });

  it("represents ClipSource without contradictory fields", () => {
    const decodeSource = Schema.decodeUnknownSync(ClipSource);
    const drive = decodeSource({
      _tag: "DriveClip",
      fileId: "drv_123",
      streamUrl: "/api/drive-stream/drv_123",
    });
    expect(drive._tag).toBe("DriveClip");
  });
});
