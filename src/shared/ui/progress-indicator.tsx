"use client";

import { Label, ProgressBar as HeroProgressBar } from "@heroui/react";

export interface ProgressIndicatorProps {
  readonly value: number;
  readonly minValue?: number | undefined;
  readonly maxValue?: number | undefined;
  readonly label?: string | undefined;
  readonly showValue?: boolean | undefined;
  readonly color?: "accent" | "default" | "success" | "warning" | "danger" | undefined;
  readonly size?: "sm" | "md" | "lg" | undefined;
  readonly className?: string | undefined;
}

export function ProgressIndicator({
  value,
  minValue = 0,
  maxValue = 100,
  label,
  showValue = true,
  color = "accent",
  size = "sm",
  className = "",
}: ProgressIndicatorProps) {
  return (
    <HeroProgressBar
      value={value}
      minValue={minValue}
      maxValue={maxValue}
      color={color}
      size={size}
      className={className}
    >
      {label || showValue ? (
        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
          {label ? <Label className="text-zinc-300">{label}</Label> : <span />}
          {showValue ? <HeroProgressBar.Output className="font-mono text-zinc-300" /> : null}
        </div>
      ) : null}
      <HeroProgressBar.Track>
        <HeroProgressBar.Fill />
      </HeroProgressBar.Track>
    </HeroProgressBar>
  );
}
