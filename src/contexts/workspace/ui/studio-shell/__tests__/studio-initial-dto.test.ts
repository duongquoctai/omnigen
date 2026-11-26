import { describe, expect, it } from "vitest";

import {
  hydrateLibraryFromDto,
  hydrateRecordsFromDto,
  hydrateVoicesFromDto,
} from "../studio-initial-dto";

describe("workspace/ui/studio-initial-dto", () => {
  it("hydrates plain DTOs into Option-bearing domain models", () => {
    const library = hydrateLibraryFromDto({
      open: [
        {
          id: "c1",
          name: "Clip 1",
          fileName: "c1.mp4",
          category: "open",
          duration: 4,
          localUrl: "/api/media/c1.mp4",
          localPath: "/tmp/c1.mp4",
          lockFlipH: true,
        },
      ],
      product: [],
      texture: [],
      apply: [],
      end: [],
    });
    expect(library.open).toHaveLength(1);
    expect(library.open[0]?.source._tag).toBe("LocalClip");
    expect(library.open[0]?.contentHash._tag).toBe("None");

    const voices = hydrateVoicesFromDto([
      {
        id: "v1",
        name: "Voice 1",
        fileName: "v1.mp3",
        localUrl: "/api/media/v1.mp3",
        duration: 12,
      },
    ]);
    expect(voices[0]?.localPath._tag).toBe("None");

    const records = hydrateRecordsFromDto([
      {
        id: "r1",
        folderId: "f1",
        tupleKey: "a|b",
        name: "Video #1",
        outputUrl: "/api/media/out.mp4",
        status: "used",
        renderedAt: "2026-01-01",
      },
    ]);
    expect(records[0]?.outputUrl._tag).toBe("Some");
  });
});
