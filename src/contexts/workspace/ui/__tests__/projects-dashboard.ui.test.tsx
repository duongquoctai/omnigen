// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectsDashboard } from "../projects-dashboard";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  createProjectAction: vi.fn(),
  renameProjectAction: vi.fn(),
  deleteProjectAction: vi.fn(),
}));

const accessActionMocks = vi.hoisted(() => ({
  listProjectSharesAction: vi.fn().mockResolvedValue({
    ok: true,
    data: { shares: [], systemUsers: [] },
  }),
  shareProjectAction: vi.fn(),
  removeProjectShareAction: vi.fn(),
  logoutAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("../actions", () => actionMocks);
vi.mock("@/contexts/access/ui/actions", () => accessActionMocks);

describe("workspace/ui/ProjectsDashboard", () => {
  it("renders empty state and DB disconnect warning", () => {
    render(
      <ProjectsDashboard
        initialProjects={[]}
        currentUser={{ id: "u1", name: "Tai", email: "tai@example.com" }}
        dbStatus={{ isCloud: true, connected: false, error: "node paused" }}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByText("Chưa có dự án nào")).toBeInTheDocument();
    expect(screen.getByText("node paused")).toBeInTheDocument();
  });

  it("renders owned & shared projects, edits, deletes, and logs out via UserAvatarMenu", async () => {
    const user = userEvent.setup();
    actionMocks.deleteProjectAction.mockResolvedValue({
      ok: true,
      data: { deletedId: "p1" },
    });
    actionMocks.renameProjectAction.mockResolvedValue({
      ok: true,
      data: { id: "p1", name: "Skin1004 Updated", description: "New desc" },
    });

    render(
      <ProjectsDashboard
        initialProjects={[
          {
            id: "p1",
            name: "Skin1004",
            description: "Serum",
            foldersCount: 2,
            poolCount: 65,
            renderedCount: 23,
            isOwner: true,
          },
          {
            id: "p_shared",
            name: "Shared Brand",
            foldersCount: 1,
            isOwner: false,
            ownerName: "Lan",
            permissionBadges: ["Lịch sử: view, export"],
          },
        ]}
        currentUser={{ id: "u1", name: "Tai", email: "tai@example.com" }}
        dbStatus={{ isCloud: false, connected: true }}
        onLogout={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("Skin1004")).toBeInTheDocument();
    expect(screen.getByText("Shared Brand")).toBeInTheDocument();
    expect(screen.getByText("2 folder")).toBeInTheDocument();
    expect(screen.getByText("65 clip")).toBeInTheDocument();
    expect(screen.getByText("23 đã render")).toBeInTheDocument();
    expect(screen.getByText("Lịch sử: view, export")).toBeInTheDocument();

    // Edit project via ⋮ dropdown menu
    await user.click(screen.getByRole("button", { name: "Thao tác cho dự án Skin1004" }));
    await user.click(screen.getByRole("menuitem", { name: "Chỉnh sửa dự án" }));
    const nameInput = screen.getByDisplayValue("Skin1004");
    await user.clear(nameInput);
    await user.type(nameInput, "Skin1004 Updated");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => {
      expect(actionMocks.renameProjectAction).toHaveBeenCalledWith({
        id: "p1",
        name: "Skin1004 Updated",
        description: "Serum",
      });
    });

    // Delete project via ⋮ dropdown menu
    await user.click(screen.getByRole("button", { name: "Thao tác cho dự án Skin1004" }));
    await user.click(screen.getByRole("menuitem", { name: "Xóa dự án" }));
    const confirmBtns = screen.getAllByRole("button", { name: "Xóa dự án" });
    const confirmBtn = confirmBtns.at(-1);
    if (confirmBtn) {
      await user.click(confirmBtn);
    }

    await waitFor(() => {
      expect(actionMocks.deleteProjectAction).toHaveBeenCalledWith({ id: "p1" });
      expect(routerMocks.refresh).toHaveBeenCalled();
    });

    // Create project
    actionMocks.createProjectAction.mockResolvedValue({ ok: true, data: { id: "p2" } });
    await user.click(screen.getByRole("button", { name: "Tạo dự án" }));
    await user.type(screen.getByPlaceholderText("Ví dụ: Skin1004 Centella"), "Project 2");
    const submitBtns = screen.getAllByRole("button", { name: "Tạo dự án" });
    const submitBtn = submitBtns.at(-1);
    if (submitBtn) {
      await user.click(submitBtn);
    }
    await waitFor(() => {
      expect(actionMocks.createProjectAction).toHaveBeenCalledWith({
        name: "Project 2",
        description: "",
        ownerId: "u1",
      });
    });

    // Logout via UserAvatarMenu
    await user.click(screen.getByRole("button", { name: "Menu tài khoản" }));
    await user.click(screen.getByRole("menuitem", { name: "Đăng xuất" }));
    await waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalledWith("/login");
    });
  });
});
