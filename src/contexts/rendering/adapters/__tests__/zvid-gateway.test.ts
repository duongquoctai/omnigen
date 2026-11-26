import crypto from "node:crypto";

import { Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";

import type { FolderId, RenderJobId, Seconds } from "@/contexts/shared-kernel";
import { AppConfig } from "@/platform/config";
import { HttpClient, makeHttpClient } from "@/platform/http/client";

import { ZvidGateway } from "../../workflows/ports";
import { verifyZvidWebhookSignature, ZvidGatewayLive } from "../zvid-gateway";

describe("rendering/adapters/zvid-gateway", () => {
  it("verifies HMAC-SHA256 webhook signatures securely", () => {
    const secret = "webhook_secret_123";
    const body = JSON.stringify({ jobId: "z1", status: "completed" });
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");

    expect(
      verifyZvidWebhookSignature({ rawBody: body, signatureHeader: `sha256=${sig}`, secret }),
    ).toBe(true);
    expect(
      verifyZvidWebhookSignature({ rawBody: body, signatureHeader: "sha256=bad", secret }),
    ).toBe(false);
    expect(verifyZvidWebhookSignature({ rawBody: body, signatureHeader: null, secret })).toBe(
      false,
    );
  });

  it("validates and submits render jobs via ZvidGatewayLive", async () => {
    const fetchMock: typeof fetch = (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/validate")) {
        return Promise.resolve(
          new Response(JSON.stringify({ valid: true, creditsRequired: 3 }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ jobId: "zvid_99" }), { status: 200 }));
    };

    const BaseLayer = Layer.mergeAll(
      Layer.succeed(AppConfig, {
        nodeEnv: "test",
        authSecret: "test",
        sqliteCloudUrl: Option.none(),
        pythonBackendUrl: "http://127.0.0.1:3006",
        zvidApiKey: Option.some("zvid_key"),
        zvidWebhookSecret: Option.none(),
      }),
      Layer.succeed(HttpClient, makeHttpClient(fetchMock)),
    );

    const GatewayLayer = ZvidGatewayLive.pipe(Layer.provide(BaseLayer));
    const plan = {
      plannedVideoId: "pv_1",
      folderId: "fld_1" as FolderId,
      name: "Mix #1",
      tupleKey: "a|b|c|d|e",
      duration: 20 as Seconds,
    };

    const res = await Effect.runPromise(
      Effect.gen(function* () {
        const gw = yield* ZvidGateway;
        const credits = yield* gw.validate({
          _tag: "Draft",
          id: "job_1" as RenderJobId,
          plan,
        });
        const zvidId = yield* gw.submit({
          _tag: "Validated",
          id: "job_1" as RenderJobId,
          plan,
          creditsRequired: credits,
        });
        return { credits, zvidId };
      }).pipe(Effect.provide(GatewayLayer)),
    );

    expect(res.credits).toBe(3);
    expect(res.zvidId).toBe("zvid_99");
  });
});
