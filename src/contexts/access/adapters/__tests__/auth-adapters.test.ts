import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { vi } from "vitest";

import { AppConfig } from "@/platform/config";
import { makeSqlClientFromDatabase, SqlClient } from "@/platform/sql";

import { PasswordHasher, SessionCookiePort, TokenIssuer, UserRepo } from "../../workflows/ports";
import {
  PasswordHasherLive,
  SessionCookieLive,
  TokenIssuerLive,
  UserRepoLive,
} from "../auth-adapters";
import { verifySessionToken } from "../token-verifier";

const cookieMocks = vi.hoisted(() => ({
  set: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieMocks),
}));

describe("access/adapters/auth-adapters", () => {
  it.effect("hashes and verifies passwords via PasswordHasherLive", () =>
    Effect.gen(function* () {
      const hasher = yield* PasswordHasher;
      const hashed = yield* hasher.hash("secret123");
      expect(yield* hasher.verify("secret123", hashed)).toBe(true);
      expect(yield* hasher.verify("wrong", hashed)).toBe(false);
    }).pipe(Effect.provide(PasswordHasherLive)),
  );

  it.effect("issues verifiable HMAC tokens via TokenIssuerLive", () => {
    const secret = "unit_test_secret";
    const CfgLayer = Layer.succeed(AppConfig, {
      nodeEnv: "test",
      authSecret: secret,
      sqliteCloudUrl: Option.none(),
      pythonBackendUrl: "http://127.0.0.1:3006",
      zvidApiKey: Option.none(),
      zvidWebhookSecret: Option.none(),
    });

    return Effect.gen(function* () {
      const issuer = yield* TokenIssuer;
      const token = yield* issuer.sign({
        userId: "u1",
        email: "tai@example.com",
        name: "Tai",
      });
      const valid = yield* verifySessionToken({
        token,
        secret,
        nowEpochSec: Math.floor(Date.now() / 1000),
      });
      expect(valid).toBe(true);
    }).pipe(Effect.provide(TokenIssuerLive.pipe(Layer.provide(CfgLayer))));
  });

  it.effect("queries and creates users in cloud mode via UserRepoLive", () => {
    const sqlMock = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "u1",
          email: "tai@example.com",
          name: "Tai",
          password_hash: "scrypt_hash",
        },
      ])
      .mockResolvedValue([]);

    const SqlLayer = Layer.succeed(SqlClient, makeSqlClientFromDatabase({ sql: sqlMock }));

    return Effect.gen(function* () {
      const repo = yield* UserRepo;
      const found = yield* repo.findByEmail("tai@example.com");
      expect(Option.isSome(found)).toBe(true);
      if (Option.isSome(found)) {
        expect(found.value.id).toBe("u1");
      }

      const created = yield* repo.create({
        name: "New",
        email: "new@example.com",
        passwordHash: "hash",
      });
      expect(created.email).toBe("new@example.com");

      const notFound = yield* repo.findByEmail("missing@example.com");
      expect(Option.isNone(notFound)).toBe(true);
      expect(sqlMock).toHaveBeenCalledTimes(4);
    }).pipe(Effect.provide(UserRepoLive.pipe(Layer.provide(SqlLayer))));
  });

  it.effect("sets and clears session cookie via SessionCookieLive", () =>
    Effect.gen(function* () {
      const cookies = yield* SessionCookiePort;
      yield* cookies.setToken("tok_123");
      expect(cookieMocks.set).toHaveBeenCalledWith(
        "lachvid_token",
        "tok_123",
        expect.objectContaining({ httpOnly: true, path: "/" }),
      );
      yield* cookies.clearToken();
      expect(cookieMocks.delete).toHaveBeenCalledWith("lachvid_token");
    }).pipe(Effect.provide(SessionCookieLive)),
  );

  it.effect("falls back to local JSON lookup when SqlClient is not cloud", () => {
    const LocalSqlLayer = Layer.succeed(SqlClient, makeSqlClientFromDatabase(null));
    return Effect.gen(function* () {
      const repo = yield* UserRepo;
      const found = yield* repo.findByEmail("nonexistent_local_user@example.com");
      expect(Option.isNone(found)).toBe(true);
    }).pipe(Effect.provide(UserRepoLive.pipe(Layer.provide(LocalSqlLayer))));
  });
});
