// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_MODULE_PERMISSIONS } from "../../domain/sharing";
import { ShareProjectModal } from "../share-project-modal";

const actionMocks = vi.hoisted(() => ({
  listProjectSharesAction: vi.fn(),
  shareProjectAction: vi.fn(),
  removeProjectShareAction: vi.fn(),
}));

vi.mock("../actions", () => actionMocks);

describe("access/ui/ShareProjectModal", () => {
  it("loads shares, toggles permissions, submits new share, and revokes share", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onToast = vi.fn();

    actionMocks.listProjectSharesAction.mockResolvedValue({
      ok: true,
      data: {
        shares: [
          {
            id: "shr_1",
            projectId: "proj_1",
            sharedWithEmail: "existing@example.com",
            sharedWithUserId: "u1",
            sharedUserName: "Existing User",
            permissions: DEFAULT_MODULE_PERMISSIONS,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        users: [{ id: "u2", email: "new@example.com", name: "New Member" }],
      },
    });
    actionMocks.shareProjectAction.mockResolvedValue({
      ok: true,
      data: { id: "shr_2" },
    });
    actionMocks.removeProjectShareAction.mockResolvedValue({
      ok: true,
      data: { shareId: "shr_1" },
    });

    render(
      <ShareProjectModal
        projectId="proj_1"
        projectName="Skin1004"
        onClose={onClose}
        onToast={onToast}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("existing@example.com")).toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText("thanhvien@example.com");
    await user.click(emailInput);
    await user.click(screen.getByText("New Member"));

    await user.click(screen.getByRole("button", { name: "Lưu quyền chia sẻ" }));

    await waitFor(() => {
      expect(actionMocks.shareProjectAction).toHaveBeenCalledWith({
        projectId: "proj_1",
        email: "new@example.com",
        permissions: DEFAULT_MODULE_PERMISSIONS,
      });
      expect(onToast).toHaveBeenCalledWith({
        type: "success",
        text: "Đã cấp quyền chia sẻ thành công cho new@example.com.",
      });
    });

    await user.click(
      screen.getByRole("button", {
        name: "Thu hồi quyền chia sẻ của existing@example.com",
      }),
    );

    await waitFor(() => {
      expect(actionMocks.removeProjectShareAction).toHaveBeenCalledWith({
        projectId: "proj_1",
        shareId: "shr_1",
      });
    });
  });
});
