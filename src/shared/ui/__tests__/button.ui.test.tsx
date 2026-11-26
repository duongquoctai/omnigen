// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button, IconButton } from "../button";

describe("shared/ui/Button", () => {
  it("renders children and handles press", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Tạo dự án</Button>);

    const btn = screen.getByRole("button", { name: "Tạo dự án" });
    await user.click(btn);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("disables button when isLoading is true", () => {
    render(<Button isLoading>Đang lưu</Button>);
    const btn = screen.getByRole("button", { name: "Đang lưu" });
    expect(btn).toBeDisabled();
  });

  it("renders IconButton with aria-label", () => {
    render(<IconButton aria-label="Đóng">+</IconButton>);
    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
  });
});
