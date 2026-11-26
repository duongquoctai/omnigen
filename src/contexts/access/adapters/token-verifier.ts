import { Effect } from "effect";

import type { TokenPayload } from "../domain/auth";

const base64UrlToBytes = (base64Url: string): Uint8Array => {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

export const verifySessionToken = (params: {
  readonly token: string;
  readonly secret: string;
  readonly nowEpochSec: number;
}): Effect.Effect<boolean> =>
  Effect.tryPromise({
    try: async () => {
      if (!params.token || !params.secret) return false;
      const parts = params.token.split(".");
      if (parts.length !== 2) return false;
      const [payloadB64, signature] = parts;
      if (!payloadB64 || !signature) return false;

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(params.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );

      const sigBytes = base64UrlToBytes(signature);
      const dataBytes = encoder.encode(payloadB64);

      const isValid = await crypto.subtle.verify(
        "HMAC",
        key,
        sigBytes as unknown as BufferSource,
        dataBytes,
      );
      if (!isValid) return false;

      const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson) as Partial<TokenPayload>;
      return typeof payload.exp === "number" && payload.exp >= params.nowEpochSec;
    },
    catch: () => false,
  }).pipe(Effect.catch(() => Effect.succeed(false)));
