import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { FolderId, Seconds, ShotCategory, ShotId } from "../types";

describe("shared-kernel types", () => {
  it("decodes valid branded IDs and rejects empty strings", () => {
    const decodeFolder = Schema.decodeUnknownSync(FolderId);
    const decodeShot = Schema.decodeUnknownSync(ShotId);

    expect(decodeFolder("fld_1")).toBe("fld_1");
    expect(decodeShot("sht_1")).toBe("sht_1");
    expect(() => decodeFolder("")).toThrow();
  });

  it("decodes non-negative Seconds and rejects negative values", () => {
    const decodeSeconds = Schema.decodeUnknownSync(Seconds);
    expect(decodeSeconds(0)).toBe(0);
    expect(decodeSeconds(12.5)).toBe(12.5);
    expect(() => decodeSeconds(-0.1)).toThrow();
  });

  it("accepts only the 5 ShotCategory literals", () => {
    const decodeCategory = Schema.decodeUnknownSync(ShotCategory);
    expect(decodeCategory("open")).toBe("open");
    expect(decodeCategory("end")).toBe("end");
    expect(() => decodeCategory("intro")).toThrow();
  });
});
