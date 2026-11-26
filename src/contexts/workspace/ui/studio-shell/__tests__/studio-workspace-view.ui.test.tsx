// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { StudioShell } from "../studio-shell";
import { StudioWorkspaceView } from "../studio-workspace-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/contexts/footage", () => ({
  SplitTab: () => <div data-testid="split-tab">SplitTabMock</div>,
}));

vi.mock("@/contexts/composition", () => ({
  MixTab: () => <div data-testid="mix-tab">MixTabMock</div>,
}));

vi.mock("@/contexts/rendering", () => ({
  HistoryTab: () => <div data-testid="history-tab">HistoryTabMock</div>,
}));

vi.mock("@/contexts/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/contexts/access")>();
  return {
    ...actual,
    ShareProjectModal: ({ projectName }: { projectName: string }) => (
      <div data-testid="share-modal">Share {projectName}</div>
    ),
  };
});

describe("workspace/ui/StudioWorkspaceView", () => {
  it("switches between split, mix, and history tabs and opens share modal for owner", async () => {
    const user = userEvent.setup();

    render(
      <NuqsTestingAdapter>
        <StudioShell accessRole={{ _tag: "Owner" }}>
          <StudioWorkspaceView
            parentProjectId="proj_1"
            parentProjectName="Skin1004"
            folderId={"fld_1" as never}
            folderName="Thư mục 1"
            sessionId="fld_1"
            initialShots={[]}
            initialLibrary={{
              open: [],
              product: [],
              texture: [],
              apply: [],
              end: [],
            }}
            initialVoices={[]}
            initialRecords={[]}
          />
        </StudioShell>
      </NuqsTestingAdapter>,
    );

    expect(screen.getByTestId("split-tab")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Trộn ghép" }));
    await waitFor(() => {
      expect(screen.getByTestId("mix-tab")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Lịch sử..." }));
    await waitFor(() => {
      expect(screen.getByTestId("history-tab")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Chia sẻ dự án" }));
    expect(screen.getByTestId("share-modal")).toBeInTheDocument();
  });
});
