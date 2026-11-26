// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "../login-form";

describe("access/ui/LoginForm", () => {
  it("submits valid credentials and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue({ ok: true, data: { userId: "u1" } });
    const onSuccess = vi.fn();

    render(<LoginForm onLogin={onLogin} onSuccess={onSuccess} />);
    await user.type(screen.getByPlaceholderText("ten@congty.com"), "tai@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({
        email: "tai@example.com",
        password: "secret123",
      });
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("displays server error on invalid credentials", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue({
      ok: false,
      code: "InvalidCredentialsError",
      error: "Email hoặc mật khẩu không đúng.",
    });

    render(<LoginForm onLogin={onLogin} />);
    await user.type(screen.getByPlaceholderText("ten@congty.com"), "tai@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Email hoặc mật khẩu không đúng.");
    });
  });
});
