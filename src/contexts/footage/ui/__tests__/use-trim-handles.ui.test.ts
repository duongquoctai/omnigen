// @vitest-environment happy-dom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useTrimHandles } from "../use-trim-handles";

describe("footage/ui/useTrimHandles", () => {
  it("starts, moves, and ends drag while calling onChange", () => {
    const onChange = vi.fn();
    const onScrubStart = vi.fn();
    const onScrubEnd = vi.fn();

    const { result } = renderHook(() =>
      useTrimHandles({
        videoBegin: 2,
        videoEnd: 8,
        totalDuration: 20,
        onChange,
        onScrubStart,
        onScrubEnd,
      }),
    );

    Object.defineProperty(result.current.trackRef, "current", {
      value: { getBoundingClientRect: () => ({ width: 200 }) },
      writable: true,
    });

    act(() => {
      result.current.startDrag(100, "begin");
    });
    expect(onScrubStart).toHaveBeenCalledTimes(1);
    expect(result.current.activeHandle).toBe("begin");

    act(() => {
      result.current.moveDrag(120, "begin");
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.endDrag();
    });
    expect(result.current.activeHandle).toBeNull();
    expect(onScrubEnd).toHaveBeenCalledTimes(1);
  });
});
