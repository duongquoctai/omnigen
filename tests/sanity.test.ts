import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import fc from "fast-check";

describe("tooling sanity", () => {
  it.effect("runs Effect 4 with @effect/vitest", () =>
    Effect.gen(function* () {
      const value = yield* Effect.succeed(42);
      expect(value).toBe(42);
    }),
  );

  it("decodes Effect Schema and runs fast-check", () => {
    const Positive = Schema.Number.check(Schema.isGreaterThan(0));
    const decode = Schema.decodeUnknownSync(Positive);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (n) => {
        expect(decode(n)).toBe(n);
      }),
    );
  });
});
