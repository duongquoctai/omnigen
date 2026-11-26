import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { LoginInput, RegisterInput } from "../auth";

describe("access/domain/auth", () => {
  it("validates LoginInput and RegisterInput schemas", () => {
    const decodeLogin = Schema.decodeUnknownSync(LoginInput);
    expect(decodeLogin({ email: "a@b.com", password: "123" })).toEqual({
      email: "a@b.com",
      password: "123",
    });
    expect(() => decodeLogin({ email: "not-an-email", password: "123" })).toThrow();

    const decodeReg = Schema.decodeUnknownSync(RegisterInput);
    expect(decodeReg({ name: "Tai", email: "a@b.com", password: "secret" }).name).toBe("Tai");
    expect(() => decodeReg({ name: "Tai", email: "a@b.com", password: "123" })).toThrow();
  });
});
