import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import type { UserId } from "@/contexts/shared-kernel";

import { EmailAlreadyExistsError, InvalidCredentialsError } from "../../domain/auth";
import { loginWorkflow, logoutWorkflow, registerWorkflow } from "../auth-workflows";
import {
  type AuthUserRecord,
  PasswordHasher,
  SessionCookiePort,
  TokenIssuer,
  UserRepo,
} from "../ports";

const existingUser: AuthUserRecord = {
  id: "u1" as UserId,
  email: "tai@example.com",
  name: "Tai",
  passwordHash: Option.some("hash:secret"),
};

describe("access/workflows/auth", () => {
  it.effect("logs in with valid credentials and sets cookie", () => {
    let savedCookie = "";
    const TestLayer = Layer.mergeAll(
      Layer.succeed(UserRepo, {
        findByEmail: () => Effect.succeed(Option.some(existingUser)),
        create: () => Effect.succeed(existingUser),
      }),
      Layer.succeed(PasswordHasher, {
        hash: (p) => Effect.succeed(`hash:${p}`),
        verify: (p, h) => Effect.succeed(h === `hash:${p}`),
      }),
      Layer.succeed(TokenIssuer, {
        sign: (p) => Effect.succeed(`tok:${p.userId}`),
      }),
      Layer.succeed(SessionCookiePort, {
        setToken: (t) => {
          savedCookie = t;
          return Effect.void;
        },
        clearToken: () => {
          savedCookie = "";
          return Effect.void;
        },
      }),
    );

    return Effect.gen(function* () {
      const res = yield* loginWorkflow({ email: "TAI@example.com", password: "secret" });
      expect(res.userId).toBe("u1");
      expect(savedCookie).toBe("tok:u1");

      const out = yield* logoutWorkflow();
      expect(out.loggedOut).toBe(true);
      expect(savedCookie).toBe("");
    }).pipe(Effect.provide(TestLayer));
  });

  it.effect("fails login with InvalidCredentialsError on wrong password", () => {
    const TestLayer = Layer.mergeAll(
      Layer.succeed(UserRepo, {
        findByEmail: () => Effect.succeed(Option.some(existingUser)),
        create: () => Effect.succeed(existingUser),
      }),
      Layer.succeed(PasswordHasher, {
        hash: (p) => Effect.succeed(p),
        verify: () => Effect.succeed(false),
      }),
      Layer.succeed(TokenIssuer, { sign: () => Effect.succeed("t") }),
      Layer.succeed(SessionCookiePort, {
        setToken: () => Effect.void,
        clearToken: () => Effect.void,
      }),
    );

    return loginWorkflow({ email: "tai@example.com", password: "wrong" }).pipe(
      Effect.provide(TestLayer),
      Effect.flip,
      Effect.map((err) => {
        expect(err).toBeInstanceOf(InvalidCredentialsError);
      }),
    );
  });

  it.effect("registers new user and rejects duplicate email", () => {
    const BaseLayer = Layer.mergeAll(
      Layer.succeed(PasswordHasher, {
        hash: (p) => Effect.succeed(`hash:${p}`),
        verify: () => Effect.succeed(true),
      }),
      Layer.succeed(TokenIssuer, { sign: () => Effect.succeed("tok_new") }),
      Layer.succeed(SessionCookiePort, {
        setToken: () => Effect.void,
        clearToken: () => Effect.void,
      }),
    );

    const NewUserLayer = Layer.mergeAll(
      BaseLayer,
      Layer.succeed(UserRepo, {
        findByEmail: () => Effect.succeed(Option.none()),
        create: (p) =>
          Effect.succeed({
            id: "u2" as UserId,
            email: p.email,
            name: p.name,
            passwordHash: Option.some(p.passwordHash),
          }),
      }),
    );

    const DupUserLayer = Layer.mergeAll(
      BaseLayer,
      Layer.succeed(UserRepo, {
        findByEmail: () => Effect.succeed(Option.some(existingUser)),
        create: () => Effect.succeed(existingUser),
      }),
    );

    return Effect.gen(function* () {
      const created = yield* registerWorkflow({
        name: "New",
        email: "new@example.com",
        password: "password123",
      }).pipe(Effect.provide(NewUserLayer));
      expect(created.userId).toBe("u2");

      const dupErr = yield* registerWorkflow({
        name: "Dup",
        email: "tai@example.com",
        password: "password123",
      }).pipe(Effect.provide(DupUserLayer), Effect.flip);
      expect(dupErr).toBeInstanceOf(EmailAlreadyExistsError);
    });
  });
});
