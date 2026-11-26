import "server-only";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { Effect, Layer, Option } from "effect";
import { cookies } from "next/headers";

import type { UserId } from "@/contexts/shared-kernel";
import { AppConfig } from "@/platform/config";
import { PersistenceError } from "@/platform/errors";
import { SqlClient } from "@/platform/sql";

import { PasswordHasher, SessionCookiePort, TokenIssuer, UserRepo } from "../workflows/ports";
import { hashPassword, verifyPassword } from "./password";

const AUTH_COOKIE_NAME = "lachvid_token";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;
const LOCAL_FALLBACK_FILE = path.join(process.cwd(), "data", "sqlitecloud_local.json");

interface LocalUserRow {
  id: string;
  email: string;
  name: string;
  passwordHash?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface LocalShareRow {
  sharedWithEmail?: string;
  sharedWithUserId?: string | null;
}

interface LocalDbJson {
  users?: Record<string, LocalUserRow>;
  shares?: Record<string, LocalShareRow>;
  [key: string]: unknown;
}

const readLocalDb = (): LocalDbJson => {
  if (!fs.existsSync(LOCAL_FALLBACK_FILE)) return {};
  return JSON.parse(fs.readFileSync(LOCAL_FALLBACK_FILE, "utf8")) as LocalDbJson;
};

const writeLocalDb = (data: LocalDbJson): void => {
  fs.mkdirSync(path.dirname(LOCAL_FALLBACK_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FALLBACK_FILE, JSON.stringify(data, null, 2), "utf8");
};

export const PasswordHasherLive = Layer.succeed(PasswordHasher, {
  hash: (plain) => Effect.sync(() => hashPassword(plain)),
  verify: (plain, hash) => Effect.sync(() => verifyPassword(plain, hash)),
});

export const TokenIssuerLive = Layer.effect(
  TokenIssuer,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    return {
      sign: (payload) =>
        Effect.sync(() => {
          const fullPayload = {
            ...payload,
            exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
          };
          const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
          const signature = crypto
            .createHmac("sha256", config.authSecret)
            .update(payloadB64)
            .digest("base64url");
          return `${payloadB64}.${signature}`;
        }),
    };
  }),
);

export const SessionCookieLive = Layer.succeed(SessionCookiePort, {
  setToken: (token) =>
    Effect.tryPromise({
      try: async () => {
        const cookieStore = await cookies();
        cookieStore.set(AUTH_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_DURATION_SECONDS,
        });
      },
      catch: () => undefined,
    }).pipe(Effect.orDie),
  clearToken: () =>
    Effect.tryPromise({
      try: async () => {
        const cookieStore = await cookies();
        cookieStore.delete(AUTH_COOKIE_NAME);
      },
      catch: () => undefined,
    }).pipe(Effect.orDie),
});

export const UserRepoLive = Layer.effect(
  UserRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient;

    return {
      findByEmail: (email) =>
        sql.isCloud
          ? sql.query`SELECT id, email, name, password_hash FROM lachvid_users WHERE lower(email) = lower(${email}) LIMIT 1`.pipe(
              Effect.map((rows) => {
                const row = rows.at(0);
                if (!row || typeof row.id !== "string") return Option.none();
                return Option.some({
                  id: row.id as UserId,
                  email: typeof row.email === "string" ? row.email : "",
                  name: typeof row.name === "string" ? row.name : "",
                  passwordHash:
                    typeof row.password_hash === "string" && row.password_hash.length > 0
                      ? Option.some(row.password_hash)
                      : Option.none(),
                });
              }),
            )
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const found = Object.values(db.users ?? {}).find(
                  (u) => u.email.toLowerCase() === email.toLowerCase(),
                );
                if (!found) return Option.none();
                return Option.some({
                  id: found.id as UserId,
                  email: found.email,
                  name: found.name,
                  passwordHash: Option.fromNullishOr(found.passwordHash),
                });
              },
              catch: (cause) =>
                new PersistenceError({
                  message: cause instanceof Error ? cause.message : String(cause),
                  cause,
                }),
            }),
      create: ({ name, email, passwordHash }) => {
        const id = `usr_${crypto.randomUUID().slice(0, 8)}` as UserId;
        const now = new Date().toISOString();
        return sql.isCloud
          ? Effect.gen(function* () {
              yield* sql.execute`
                INSERT INTO lachvid_users (id, email, name, password_hash, created_at, updated_at)
                VALUES (${id}, ${email}, ${name}, ${passwordHash}, ${now}, ${now})
              `;
              yield* sql.execute`
                UPDATE lachvid_resource_shares
                SET shared_with_user_id = ${id}
                WHERE lower(shared_with_email) = lower(${email}) AND shared_with_user_id IS NULL
              `;
              return {
                id,
                email,
                name,
                passwordHash: Option.some(passwordHash),
              };
            })
          : Effect.try({
              try: () => {
                const db = readLocalDb();
                const users = db.users ?? {};
                users[id] = { id, email, name, passwordHash, createdAt: now, updatedAt: now };
                const shares = db.shares ?? {};
                for (const s of Object.values(shares)) {
                  if (
                    s.sharedWithEmail?.toLowerCase() === email.toLowerCase() &&
                    !s.sharedWithUserId
                  ) {
                    s.sharedWithUserId = id;
                  }
                }
                writeLocalDb({ ...db, users, shares });
                return {
                  id,
                  email,
                  name,
                  passwordHash: Option.some(passwordHash),
                };
              },
              catch: (cause) =>
                new PersistenceError({
                  message: cause instanceof Error ? cause.message : String(cause),
                  cause,
                }),
            });
      },
    };
  }),
);
