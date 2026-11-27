import "server-only";

import { Context, Effect, Layer, Option, Schema } from "effect";

import { DEV_AUTH_SECRET } from "./auth-secret";
import { ConfigError } from "./errors";

const EnvSchema = Schema.Struct({
  NODE_ENV: Schema.Literals(["development", "production", "test"]),
  AUTH_SECRET: Schema.OptionFromUndefinedOr(Schema.NonEmptyString),
  SQLITE_CLOUD_URL: Schema.OptionFromUndefinedOr(Schema.NonEmptyString),
  PYTHON_BACKEND_URL: Schema.NonEmptyString,
  ZVID_API_KEY: Schema.OptionFromUndefinedOr(Schema.NonEmptyString),
  ZVID_WEBHOOK_SECRET: Schema.OptionFromUndefinedOr(Schema.NonEmptyString),
});

export interface AppConfigValue {
  readonly nodeEnv: "development" | "production" | "test";
  readonly authSecret: string;
  readonly sqliteCloudUrl: Option.Option<string>;
  readonly pythonBackendUrl: string;
  readonly zvidApiKey: Option.Option<string>;
  readonly zvidWebhookSecret: Option.Option<string>;
}

export class AppConfig extends Context.Service<AppConfig, AppConfigValue>()("platform/AppConfig") {}

export const loadAppConfig = (
  env: Record<string, string | undefined> = process.env,
): Effect.Effect<AppConfigValue, ConfigError> =>
  Effect.gen(function* () {
    const raw = yield* Schema.decodeUnknownEffect(EnvSchema)({
      NODE_ENV: env.NODE_ENV ?? "development",
      AUTH_SECRET: env.AUTH_SECRET ?? env.NEXTAUTH_SECRET,
      SQLITE_CLOUD_URL: env.SQLITE_CLOUD_URL,
      PYTHON_BACKEND_URL: env.PYTHON_BACKEND_URL ?? "http://127.0.0.1:3006",
      ZVID_API_KEY: env.ZVID_API_KEY,
      ZVID_WEBHOOK_SECRET: env.ZVID_WEBHOOK_SECRET,
    }).pipe(
      Effect.mapError((err) => new ConfigError({ message: `Invalid env config: ${String(err)}` })),
    );

    const authSecret = yield* Option.match(raw.AUTH_SECRET, {
      onSome: (secret) => Effect.succeed(secret),
      onNone: () => {
        if (raw.NODE_ENV === "production") {
          return Effect.fail(
            new ConfigError({
              message: "AUTH_SECRET (or NEXTAUTH_SECRET) must be set in production.",
            }),
          );
        }
        return Effect.succeed(DEV_AUTH_SECRET);
      },
    });

    return {
      nodeEnv: raw.NODE_ENV,
      authSecret,
      sqliteCloudUrl: raw.SQLITE_CLOUD_URL,
      pythonBackendUrl: raw.PYTHON_BACKEND_URL,
      zvidApiKey: raw.ZVID_API_KEY,
      zvidWebhookSecret: raw.ZVID_WEBHOOK_SECRET,
    };
  });

export const AppConfigLive = Layer.effect(AppConfig, loadAppConfig());
