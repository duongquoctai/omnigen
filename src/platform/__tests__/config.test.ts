import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import { resolveAuthSecret } from "../auth-secret";
import { loadAppConfig } from "../config";

describe("platform/config", () => {
  it("fails fast in production when AUTH_SECRET is missing", async () => {
    const result = await Effect.runPromise(Effect.flip(loadAppConfig({ NODE_ENV: "production" })));
    expect(result._tag).toBe("ConfigError");
    expect(result.message).toContain("AUTH_SECRET");
  });

  it("loads production config when AUTH_SECRET is provided", async () => {
    const cfg = await Effect.runPromise(
      loadAppConfig({
        NODE_ENV: "production",
        AUTH_SECRET: "super-secure-secret-key",
        PYTHON_BACKEND_URL: "http://127.0.0.1:3006",
      }),
    );
    expect(cfg.authSecret).toBe("super-secure-secret-key");
    expect(Option.isNone(cfg.sqliteCloudUrl)).toBe(true);
  });

  it("provides dev secret fallback only in non-production", async () => {
    const cfg = await Effect.runPromise(loadAppConfig({ NODE_ENV: "test" }));
    expect(cfg.authSecret).toContain("dev_only");
    expect(cfg.authSecret).toBe(resolveAuthSecret({ NODE_ENV: "test" }));
    expect(resolveAuthSecret({ NODE_ENV: "production" })).toBe("");
    expect(cfg.pythonBackendUrl).toBe("http://127.0.0.1:3006");
  });
});
