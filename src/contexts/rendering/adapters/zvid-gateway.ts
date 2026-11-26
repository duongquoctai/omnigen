import crypto from "node:crypto";

import { Effect, Layer, Option, Schema } from "effect";

import { AppConfig } from "@/platform/config";
import { HttpClient } from "@/platform/http/client";

import { ZvidSubmitFailed, ZvidValidationFailed } from "../domain/errors";
import type { Credits, ZvidJobId } from "../domain/types";
import { ZvidGateway } from "../workflows/ports";

const ZvidValidateResponseDto = Schema.Struct({
  valid: Schema.Boolean,
  creditsRequired: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
});

const ZvidSubmitResponseDto = Schema.Struct({
  jobId: Schema.NonEmptyString,
});

export const verifyZvidWebhookSignature = (params: {
  readonly rawBody: string;
  readonly signatureHeader: string | null;
  readonly secret: string;
}): boolean => {
  if (!params.signatureHeader || !params.secret) return false;
  const expected = crypto.createHmac("sha256", params.secret).update(params.rawBody).digest("hex");
  const actual = params.signatureHeader.replace(/^sha256=/, "");
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
};

export const ZvidGatewayLive = Layer.effect(
  ZvidGateway,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const http = yield* HttpClient;

    const getApiKey = (): string => Option.getOrElse(config.zvidApiKey, () => "");

    return {
      validate: (job) =>
        http
          .fetchJson(
            {
              service: "zvid",
              url: "https://api.zvid.io/v1/render/validate",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": getApiKey(),
              },
              body: JSON.stringify({
                name: job.plan.name,
                duration: job.plan.duration,
              }),
            },
            ZvidValidateResponseDto,
          )
          .pipe(
            Effect.flatMap((res) =>
              res.valid
                ? Effect.succeed((res.creditsRequired ?? 1) as Credits)
                : Effect.fail(
                    new ZvidValidationFailed({
                      message: res.error ?? "Zvid từ chối cấu hình render.",
                    }),
                  ),
            ),
            Effect.mapError((err) =>
              err instanceof ZvidValidationFailed
                ? err
                : new ZvidValidationFailed({ message: err.message }),
            ),
          ),
      submit: (job) =>
        http
          .fetchJson(
            {
              service: "zvid",
              url: "https://api.zvid.io/v1/render",
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": getApiKey(),
              },
              body: JSON.stringify({
                idempotencyKey: job.id,
                name: job.plan.name,
                duration: job.plan.duration,
              }),
            },
            ZvidSubmitResponseDto,
          )
          .pipe(
            Effect.map((res) => res.jobId as ZvidJobId),
            Effect.mapError((err) => new ZvidSubmitFailed({ message: err.message })),
          ),
    };
  }),
);
