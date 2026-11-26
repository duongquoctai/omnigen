import { Effect, Option } from "effect";

import {
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  type LoginInput,
  type RegisterInput,
} from "../domain/auth";
import { PasswordHasher, SessionCookiePort, TokenIssuer, UserRepo } from "./ports";

export interface AuthSessionResult {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
}

export const loginWorkflow = (input: LoginInput) =>
  Effect.gen(function* () {
    const users = yield* UserRepo;
    const hasher = yield* PasswordHasher;
    const issuer = yield* TokenIssuer;
    const cookies = yield* SessionCookiePort;

    const found = yield* users.findByEmail(input.email.trim().toLowerCase());
    if (Option.isNone(found)) {
      return yield* Effect.fail(
        new InvalidCredentialsError({
          message: "Email hoặc mật khẩu không đúng.",
        }),
      );
    }

    const user = found.value;
    if (Option.isNone(user.passwordHash)) {
      return yield* Effect.fail(
        new InvalidCredentialsError({
          message: "Tài khoản này chưa thiết lập mật khẩu.",
        }),
      );
    }

    const ok = yield* hasher.verify(input.password, user.passwordHash.value);
    if (!ok) {
      return yield* Effect.fail(
        new InvalidCredentialsError({
          message: "Email hoặc mật khẩu không đúng.",
        }),
      );
    }

    const token = yield* issuer.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    yield* cookies.setToken(token);

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
    } satisfies AuthSessionResult;
  });

export const registerWorkflow = (input: RegisterInput) =>
  Effect.gen(function* () {
    const users = yield* UserRepo;
    const hasher = yield* PasswordHasher;
    const issuer = yield* TokenIssuer;
    const cookies = yield* SessionCookiePort;

    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = yield* users.findByEmail(normalizedEmail);
    if (Option.isSome(existing)) {
      return yield* Effect.fail(
        new EmailAlreadyExistsError({
          email: normalizedEmail,
          message: "Email này đã được sử dụng.",
        }),
      );
    }

    const passwordHash = yield* hasher.hash(input.password);
    const created = yield* users.create({
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    const token = yield* issuer.sign({
      userId: created.id,
      email: created.email,
      name: created.name,
    });
    yield* cookies.setToken(token);

    return {
      userId: created.id,
      email: created.email,
      name: created.name,
    } satisfies AuthSessionResult;
  });

export const logoutWorkflow = () =>
  Effect.gen(function* () {
    const cookies = yield* SessionCookiePort;
    yield* cookies.clearToken();
    return { loggedOut: true } as const;
  });
