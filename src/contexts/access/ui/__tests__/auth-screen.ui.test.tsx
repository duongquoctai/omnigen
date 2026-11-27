// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthScreen } from "../auth-screen";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  loginAction: vi.fn(),
  registerAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("../actions", () => actionMocks);

describe("access/ui/AuthScreen", () => {
  it("switches between login and register modes and submits register", async () => {
    const user = userEvent.setup();
    actionMocks.registerAction.mockResolvedValue({
      ok: true,
      data: { userId: "u2", email: "new@example.com", name: "New" },
    });

    render(<AuthScreen callbackUrl="/projects/1" />);
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    await user.type(screen.getByPlaceholderText("Nguyễn Văn A"), "New User");
    await user.type(screen.getByPlaceholderText("ten@congty.com"), "new@example.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "secret123");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    await waitFor(() => {
      expect(actionMocks.registerAction).toHaveBeenCalledWith({
        name: "New User",
        email: "new@example.com",
        password: "secret123",
      });
      expect(routerMocks.push).toHaveBeenCalledWith("/projects/1");
    });
  });
});
