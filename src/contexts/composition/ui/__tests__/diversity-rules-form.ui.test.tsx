// @vitest-environment happy-dom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DiversityRulesForm } from "../diversity-rules-form";

describe("composition/ui/DiversityRulesForm", () => {
  it("submits parsed diversity rules via useActionForm", async () => {
    const user = userEvent.setup();
    const onPlanMix = vi.fn().mockResolvedValue({ ok: true, data: {} });

    render(<DiversityRulesForm canEdit={true} onPlanMix={onPlanMix} />);
    await user.click(screen.getByRole("button", { name: "Lên kế hoạch phối trộn" }));

    await waitFor(() => {
      expect(onPlanMix).toHaveBeenCalledWith({
        targetCount: 10,
        targetOutputDuration: 20,
        minHammingDistance: 2,
        maxShotFrequency: 5,
        seed: 42,
      });
    });
  });

  it("displays validation error when minHammingDistance is out of range", async () => {
    const user = userEvent.setup();
    const onPlanMix = vi.fn().mockResolvedValue({ ok: true, data: {} });

    render(<DiversityRulesForm canEdit={true} onPlanMix={onPlanMix} />);
    const hammingInput = screen.getByDisplayValue("2");
    await user.clear(hammingInput);
    await user.type(hammingInput, "9");
    await user.click(screen.getByRole("button", { name: "Lên kế hoạch phối trộn" }));

    await waitFor(() => {
      expect(onPlanMix).not.toHaveBeenCalled();
    });
  });
});
