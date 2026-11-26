import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeMediaStorage } from "../media-storage";

describe("platform/storage/media-storage", () => {
  let tmpRoot = "";
  let sessionsDir = "";
  let dataDir = "";

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lachvid-storage-test-"));
    sessionsDir = path.join(tmpRoot, "sessions");
    dataDir = path.join(tmpRoot, "data");
    fs.mkdirSync(path.join(sessionsDir, "sess_1", "source"), { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(sessionsDir, "sess_1", "source", "clip.mp4"), "video");
    fs.writeFileSync(path.join(tmpRoot, "secret.txt"), "secret");
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("sanitizes session IDs safely", () => {
    const storage = makeMediaStorage({ baseSessionsDir: sessionsDir, dataDir });
    expect(storage.sanitizeSessionId("../../etc/passwd")).toBe("etcpasswd");
    expect(storage.sanitizeSessionId("")).toBe("default_session");
    expect(storage.sanitizeSessionId("sess_abc-123")).toBe("sess_abc-123");
  });

  it("resolves valid session media paths", async () => {
    const storage = makeMediaStorage({ baseSessionsDir: sessionsDir, dataDir });
    const resolved = await Effect.runPromise(
      storage.resolveSafePath(["sessions", "sess_1", "source", "clip.mp4"]),
    );
    expect(resolved).toBe(path.join(sessionsDir, "sess_1", "source", "clip.mp4"));
  });

  it("blocks path traversal attempts", async () => {
    const storage = makeMediaStorage({ baseSessionsDir: sessionsDir, dataDir });
    const err = await Effect.runPromise(
      Effect.flip(storage.resolveSafePath(["sessions", "..", "secret.txt"])),
    );
    expect(err._tag).toBe("StorageError");
  });
});
