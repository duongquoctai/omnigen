"use client";

import { Label, Slider as HeroSlider } from "@heroui/react";

export interface RangeSliderProps {
  readonly label?: string | undefined;
  readonly value: number;
  readonly onValueChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number | undefined;
  readonly showOutput?: boolean | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
}

export function RangeSlider({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 0.05,
  showOutput = false,
  isDisabled = false,
  ariaLabel,
  className = "",
}: RangeSliderProps) {
  return (
    <HeroSlider
      value={value}
      onChange={(next) => {
        const numeric = Array.isArray(next) ? next[0] : next;
        if (typeof numeric === "number" && Number.isFinite(numeric)) {
          onValueChange(numeric);
        }
      }}
      minValue={min}
      maxValue={max}
      step={step}
      isDisabled={isDisabled}
      aria-label={ariaLabel ?? label ?? "Thanh trượt"}
      className={className}
    >
      {label || showOutput ? (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          {label ? <Label className="text-zinc-300">{label}</Label> : <span />}
          {showOutput ? <HeroSlider.Output className="font-mono text-zinc-300" /> : null}
        </div>
      ) : null}
      <HeroSlider.Track className="h-1 bg-zinc-800">
        <HeroSlider.Fill className="h-1 bg-indigo-500" />
        <HeroSlider.Thumb className="h-3.5 w-3.5 border-2 border-indigo-400 bg-white shadow-sm" />
      </HeroSlider.Track>
    </HeroSlider>
  );
}
