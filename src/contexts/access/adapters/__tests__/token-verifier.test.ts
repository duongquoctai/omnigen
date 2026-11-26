import crypto from "node:crypto";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { verifySessionToken } from "../token-verifier";

const signTestToken = (payload: object, secret: string): string => {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(b64).digest("base64url");
  return `${b64}.${sig}`;
};

describe("access/adapters/token-verifier", () => {
  it("verifies valid HMAC token and rejects expired or tampered tokens", async () => {
    const secret = "test_secret_123";
    const now = 1_700_000_000;
    const validToken = signTestToken(
      { userId: "u1", email: "a@b.com", name: "A", exp: now + 60 },
      secret,
    );
    const expiredToken = signTestToken(
      { userId: "u1", email: "a@b.com", name: "A", exp: now - 10 },
      secret,
    );

    expect(
      await Effect.runPromise(verifySessionToken({ token: validToken, secret, nowEpochSec: now })),
    ).toBe(true);
    expect(
      await Effect.runPromise(
        verifySessionToken({ token: expiredToken, secret, nowEpochSec: now }),
      ),
    ).toBe(false);
    expect(
      await Effect.runPromise(
        verifySessionToken({ token: `${validToken}tamper`, secret, nowEpochSec: now }),
      ),
    ).toBe(false);
  });
});
