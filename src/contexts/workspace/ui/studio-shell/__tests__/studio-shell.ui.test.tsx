// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import type { AccessRole } from "@/contexts/access";

import { usePermission } from "../permission-context";
import { StudioShell } from "../studio-shell";
import { useStudioTab } from "../studio-tab";
import { useToast } from "../toast-context";

function ShellProbe() {
  const { can, canManageFolders, notifyDenied } = usePermission();
  const { addToast } = useToast();
  const [tab, setTab] = useStudioTab("split");

  return (
    <div>
      <span data-testid="tab">{tab}</span>
      <span data-testid="can-edit-split">{String(can("split", "edit"))}</span>
      <span data-testid="can-manage">{String(canManageFolders)}</span>
      <button
        type="button"
        onClick={() => {
          void setTab("mix");
        }}
      >
        Sang tab mix
      </button>
      <button
        type="button"
        onClick={() => {
          addToast("success", "Đã lưu");
        }}
      >
        Hiện toast
      </button>
      <button
        type="button"
        onClick={() => {
          notifyDenied("chỉnh sửa");
        }}
      >
        Từ chối quyền
      </button>
    </div>
  );
}

describe("workspace/ui/studio-shell", () => {
  it("provides permission, toast, and URL tab state", async () => {
    const user = userEvent.setup();
    const role: AccessRole = {
      _tag: "Collaborator",
      permissions: {
        split: { _tag: "Enabled", actions: ["view"] },
        mix: { _tag: "Enabled", actions: ["view", "export"] },
        history: { _tag: "Disabled" },
      },
    };

    render(
      <NuqsTestingAdapter searchParams="?tab=split">
        <StudioShell accessRole={role}>
          <ShellProbe />
        </StudioShell>
      </NuqsTestingAdapter>,
    );

    expect(screen.getByTestId("tab")).toHaveTextContent("split");
    expect(screen.getByTestId("can-edit-split")).toHaveTextContent("false");
    expect(screen.getByTestId("can-manage")).toHaveTextContent("false");

    await user.click(screen.getByRole("button", { name: "Sang tab mix" }));
    expect(screen.getByTestId("tab")).toHaveTextContent("mix");

    await user.click(screen.getByRole("button", { name: "Hiện toast" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã lưu");

    await user.click(screen.getByRole("button", { name: "Từ chối quyền" }));
    expect(screen.getByText(/không có quyền chỉnh sửa/i)).toBeInTheDocument();

    const closeBtns = screen.getAllByRole("button", { name: "Đóng thông báo" });
    const firstClose = closeBtns.at(0);
    if (firstClose) {
      await user.click(firstClose);
    }
    expect(screen.queryByText("Đã lưu")).not.toBeInTheDocument();
  });
});
