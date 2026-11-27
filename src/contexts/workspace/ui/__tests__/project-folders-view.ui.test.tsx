// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { ProjectFoldersView } from "../project-folders-view";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

const actionMocks = vi.hoisted(() => ({
  createFolderAction: vi.fn(),
  renameFolderAction: vi.fn(),
  deleteFolderAction: vi.fn(),
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

describe("workspace/ui/ProjectFoldersView", () => {
  it("renders empty state when there are no folders", () => {
    render(
      <NuqsTestingAdapter>
        <ProjectFoldersView
          project={{ id: "p1", name: "Skin1004", isOwner: false }}
          initialFolders={[]}
          canManageFolders={false}
        />
      </NuqsTestingAdapter>,
    );
    expect(screen.getByText("Chưa có thư mục làm việc nào")).toBeInTheDocument();
    expect(screen.getByText("Được chia sẻ")).toBeInTheDocument();
  });

  it("supports searching folders and clicking folder card to navigate", async () => {
    const user = userEvent.setup();
    routerMocks.push.mockClear();

    render(
      <NuqsTestingAdapter>
        <ProjectFoldersView
          project={{ id: "p1", name: "Skin1004", isOwner: true }}
          initialFolders={[
            { id: "f1", name: "Kem chống nắng", poolCount: 3, renderedCount: 1 },
            { id: "f2", name: "Sữa rửa mặt", poolCount: 5, renderedCount: 2 },
          ]}
          canManageFolders={true}
        />
      </NuqsTestingAdapter>,
    );

    expect(screen.queryByText("Mở folder")).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Tìm kiếm folder..."), "rửa mặt");
    expect(screen.queryByText("Kem chống nắng")).not.toBeInTheDocument();
    expect(screen.getByText("Sữa rửa mặt")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Mở folder Sữa rửa mặt" }));
    expect(routerMocks.push).toHaveBeenCalledWith("/projects/p1/folders/f2");
  });

  it("creates, renames, and deletes a folder via Server Actions", async () => {
    const user = userEvent.setup();
    routerMocks.push.mockClear();
    actionMocks.createFolderAction.mockResolvedValue({ ok: true, data: { id: "f2" } });
    actionMocks.renameFolderAction.mockResolvedValue({
      ok: true,
      data: { id: "f1", name: "Thư mục mới" },
    });
    actionMocks.deleteFolderAction.mockResolvedValue({
      ok: true,
      data: { deletedId: "f1" },
    });

    render(
      <NuqsTestingAdapter>
        <ProjectFoldersView
          project={{ id: "p1", name: "Skin1004", description: "Serum", isOwner: true }}
          initialFolders={[{ id: "f1", name: "Thư mục 1", poolCount: 3, renderedCount: 1 }]}
          canManageFolders={true}
          currentUser={{ id: "u1", name: "Tai", email: "tai@example.com" }}
        />
      </NuqsTestingAdapter>,
    );

    expect(screen.getByText("Thư mục 1")).toBeInTheDocument();
    expect(screen.getByText("Chủ sở hữu")).toBeInTheDocument();
    expect(screen.getByText("3 clip")).toBeInTheDocument();
    expect(screen.getByText("1 đã render")).toBeInTheDocument();

    // Rename folder via ⋮ dropdown menu
    await user.click(screen.getByRole("button", { name: "Thao tác cho folder Thư mục 1" }));
    await user.click(screen.getByRole("menuitem", { name: "Đổi tên folder" }));
    const renameInput = screen.getByDisplayValue("Thư mục 1");
    await user.clear(renameInput);
    await user.type(renameInput, "Thư mục mới");
    await user.click(screen.getByRole("button", { name: "Lưu tên mới" }));
    await waitFor(() => {
      expect(actionMocks.renameFolderAction).toHaveBeenCalledWith({
        id: "f1",
        projectId: "p1",
        name: "Thư mục mới",
      });
    });

    await user.click(screen.getByRole("button", { name: "Tạo folder mới" }));
    await user.type(screen.getByPlaceholderText("Ví dụ: Kem chống nắng"), "Thư mục 2");
    await user.click(screen.getByRole("button", { name: "Tạo folder" }));

    await waitFor(() => {
      expect(actionMocks.createFolderAction).toHaveBeenCalledWith({
        projectId: "p1",
        name: "Thư mục 2",
        description: "",
      });
    });

    await user.click(screen.getByRole("button", { name: "Thao tác cho folder Thư mục 1" }));
    await user.click(screen.getByRole("menuitem", { name: "Xóa folder" }));
    const confirmBtns = screen.getAllByRole("button", { name: "Xóa folder" });
    const confirmBtn = confirmBtns.at(-1);
    if (confirmBtn) {
      await user.click(confirmBtn);
    }

    await waitFor(() => {
      expect(actionMocks.deleteFolderAction).toHaveBeenCalledWith({
        id: "f1",
        projectId: "p1",
      });
      expect(routerMocks.refresh).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Tạo folder mới" }));
    actionMocks.createFolderAction.mockResolvedValueOnce({
      ok: false,
      code: "ValidationError",
      error: "Tên thư mục đã tồn tại",
    });
    await user.type(screen.getByPlaceholderText("Ví dụ: Kem chống nắng"), "Trùng");
    await user.click(screen.getByRole("button", { name: "Tạo folder" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Tên thư mục đã tồn tại");
    });

    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("button", { name: "Hủy" })).not.toBeInTheDocument();
  });
});
