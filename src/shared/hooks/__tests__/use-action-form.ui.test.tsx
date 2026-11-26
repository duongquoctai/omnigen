// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

import { useActionForm } from "../use-action-form";

const TestSchema = Schema.Struct({
  name: Schema.NonEmptyString,
});

function TestForm({
  action,
  onSuccess,
}: {
  readonly action: (
    input: typeof TestSchema.Type,
  ) => Promise<
    | { ok: true; data: string }
    | { ok: false; error: string; code: string; fieldErrors?: Record<string, string> }
  >;
  readonly onSuccess?: (data: string) => void;
}) {
  const { form, serverError, onSubmit } = useActionForm({
    schema: TestSchema,
    defaultValues: { name: "" },
    action,
    onSuccess,
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <input aria-label="Tên" {...form.register("name")} />
      {form.formState.errors.name ? (
        <span role="alert">{form.formState.errors.name.message}</span>
      ) : null}
      {serverError ? <p role="status">{serverError}</p> : null}
      <button type="submit">Lưu</button>
    </form>
  );
}

describe("shared/hooks/useActionForm", () => {
  it("submits valid input and calls onSuccess", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ ok: true, data: "created" });
    const onSuccess = vi.fn();

    render(<TestForm action={action} onSuccess={onSuccess} />);
    await user.type(screen.getByLabelText("Tên"), "Dự án A");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith({ name: "Dự án A" });
      expect(onSuccess).toHaveBeenCalledWith("created");
    });
  });

  it("displays server error and fieldErrors on failure", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({
      ok: false,
      code: "ValidationError",
      error: "Không hợp lệ",
      fieldErrors: { name: "Tên đã tồn tại" },
    });

    render(<TestForm action={action} />);
    await user.type(screen.getByLabelText("Tên"), "Trùng");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Không hợp lệ");
      expect(screen.getByRole("alert")).toHaveTextContent("Tên đã tồn tại");
    });
  });
});
