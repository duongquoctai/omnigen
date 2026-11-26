import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../errors";
import { makeAction, runQuery, runRoute } from "../run";

const navMocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  forbidden: vi.fn((): never => {
    throw new Error("NEXT_FORBIDDEN");
  }),
}));

vi.mock("next/navigation", () => navMocks);

const emptyRuntime = ManagedRuntime.make(Layer.empty);

describe("platform/run", () => {
  describe("makeAction", () => {
    const Input = Schema.Struct({ name: Schema.NonEmptyString });
    const action = makeAction(
      Input,
      (input) =>
        input.name === "forbidden"
          ? Effect.fail(new ForbiddenError({ message: "Không có quyền" }))
          : Effect.succeed({ greeted: input.name }),
      emptyRuntime,
    );

    it("returns ok: true on valid input and success", async () => {
      const res = await action({ name: "Lachvid" });
      expect(res).toEqual({ ok: true, data: { greeted: "Lachvid" } });
    });

    it("returns ValidationError on invalid schema input", async () => {
      const res = await action({ name: "" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("ValidationError");
      }
    });

    it("maps tagged errors to ActionFailure", async () => {
      const res = await action({ name: "forbidden" });
      expect(res).toEqual({
        ok: false,
        code: "ForbiddenError",
        error: "Không có quyền",
      });
    });

    it("catches unexpected defects safely", async () => {
      const defectAction = makeAction(Input, () => Effect.die(new Error("boom")), emptyRuntime);
      const res = await defectAction({ name: "ok" });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("UnexpectedDefect");
      }
    });
  });

  describe("runQuery", () => {
    it("redirects to /login on UnauthorizedError", async () => {
      await expect(
        runQuery(Effect.fail(new UnauthorizedError({ message: "Chưa đăng nhập" })), emptyRuntime),
      ).rejects.toThrow("NEXT_REDIRECT:/login");
    });

    it("calls notFound() on NotFoundError", async () => {
      await expect(
        runQuery(
          Effect.fail(new NotFoundError({ resource: "Folder", id: "1", message: "Không thấy" })),
          emptyRuntime,
        ),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("calls forbidden() on ForbiddenError", async () => {
      await expect(
        runQuery(Effect.fail(new ForbiddenError({ message: "Cấm" })), emptyRuntime),
      ).rejects.toThrow("NEXT_FORBIDDEN");
    });
  });

  describe("runRoute", () => {
    it("returns JSON 200 on success", async () => {
      const res = await runRoute(Effect.succeed({ ok: true }), emptyRuntime);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it("maps ValidationError to 400 and NotFoundError to 404", async () => {
      const r400 = await runRoute(
        Effect.fail(new ValidationError({ message: "Sai dữ liệu" })),
        emptyRuntime,
      );
      expect(r400.status).toBe(400);

      const r404 = await runRoute(
        Effect.fail(new NotFoundError({ resource: "Clip", message: "Không tìm thấy" })),
        emptyRuntime,
      );
      expect(r404.status).toBe(404);
    });
  });
});
