"use client";

import { Label, NumberField as HeroNumberField } from "@heroui/react";

export interface NumberInputProps {
  readonly label?: string | undefined;
  readonly value: number;
  readonly onValueChange: (value: number) => void;
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly step?: number | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
  readonly showSteppers?: boolean | undefined;
}

export function NumberInput({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  isDisabled = false,
  ariaLabel,
  className = "",
  showSteppers = true,
}: NumberInputProps) {
  return (
    <HeroNumberField
      value={value}
      onChange={(next) => {
        if (Number.isFinite(next)) {
          onValueChange(next);
        }
      }}
      {...(min !== undefined ? { minValue: min } : {})}
      {...(max !== undefined ? { maxValue: max } : {})}
      step={step}
      isDisabled={isDisabled}
      aria-label={ariaLabel ?? label ?? "Số"}
      className={className}
    >
      {label ? <Label className="text-xs font-medium text-zinc-300">{label}</Label> : null}
      <HeroNumberField.Group className="border-zinc-800 bg-zinc-900 text-zinc-100">
        {showSteppers ? <HeroNumberField.DecrementButton /> : null}
        <HeroNumberField.Input className="text-center font-mono text-xs text-white" />
        {showSteppers ? <HeroNumberField.IncrementButton /> : null}
      </HeroNumberField.Group>
    </HeroNumberField>
  );
}
