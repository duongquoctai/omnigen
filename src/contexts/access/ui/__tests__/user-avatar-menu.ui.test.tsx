// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UserAvatarMenu } from "../user-avatar-menu";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  logoutAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("../actions", () => actionMocks);

describe("access/ui/UserAvatarMenu", () => {
  it("renders login link when user is null", () => {
    render(<UserAvatarMenu user={null} />);
    expect(screen.getByRole("link", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("opens dropdown, shows projects shortcut, and logs out", async () => {
    const user = userEvent.setup();
    render(
      <UserAvatarMenu
        user={{ id: "u1", name: "Tai Do", email: "tai@example.com" }}
        showProjectsShortcut={true}
      />,
    );

    const avatarBtn = screen.getByRole("button", { name: "Menu tài khoản" });
    expect(avatarBtn).toHaveTextContent("TD");

    await user.click(avatarBtn);
    expect(screen.getByText("Tai Do")).toBeInTheDocument();
    expect(screen.getByText("tai@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Quản lý dự án" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Đăng xuất" }));
    await waitFor(() => {
      expect(actionMocks.logoutAction).toHaveBeenCalledWith({});
      expect(routerMocks.push).toHaveBeenCalledWith("/login");
    });
  });
});
