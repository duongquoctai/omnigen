// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IPhoneVideoTrimmer } from "../iphone-video-trimmer";

describe("footage/ui/IPhoneVideoTrimmer", () => {
  it("renders range, seeks preview, drags handles, and resets to raw bounds", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSeekPreview = vi.fn();

    render(
      <IPhoneVideoTrimmer
        videoBegin={2}
        videoEnd={7}
        totalDuration={20}
        rawBegin={1}
        rawEnd={8}
        onChange={onChange}
        onSeekPreview={onSeekPreview}
      />,
    );

    expect(screen.getByText("2.0s → 7.0s")).toBeInTheDocument();
    expect(screen.getByText("5.0s")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xem đầu cảnh" }));
    expect(onSeekPreview).toHaveBeenCalledWith(2);

    fireEvent.mouseDown(screen.getByRole("slider", { name: "Điểm kết thúc cảnh" }), {
      clientX: 50,
    });
    fireEvent.mouseMove(window, { clientX: 70 });
    fireEvent.mouseUp(window);
    expect(onChange).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Về cảnh gốc" }));
    expect(onChange).toHaveBeenCalledWith(1, 8);
  });
});
