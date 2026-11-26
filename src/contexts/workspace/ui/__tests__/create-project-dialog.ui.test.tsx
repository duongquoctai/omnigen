// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CreateProjectDialog } from "../create-project-dialog";

describe("workspace/ui/CreateProjectDialog", () => {
  it("submits project name and closes dialog on success", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCreateProject = vi.fn().mockResolvedValue({ ok: true, data: { id: "p1" } });

    render(
      <CreateProjectDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        onCreateProject={onCreateProject}
      />,
    );

    await user.type(screen.getByPlaceholderText("Ví dụ: Skin1004 Centella"), "Skin1004");
    await user.click(screen.getByRole("button", { name: "Tạo dự án" }));

    await waitFor(() => {
      expect(onCreateProject).toHaveBeenCalledWith({
        name: "Skin1004",
        description: "",
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("shows server error on failure and closes on cancel", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCreateProject = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "ValidationError", error: "Tên dự án đã tồn tại" });

    render(
      <CreateProjectDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        onCreateProject={onCreateProject}
      />,
    );

    await user.type(screen.getByPlaceholderText("Ví dụ: Skin1004 Centella"), "Skin1004");
    await user.click(screen.getByRole("button", { name: "Tạo dự án" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Tên dự án đã tồn tại");
    });

    await user.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
