"use client";

import { Checkbox as HeroCheckbox, Label, Switch as HeroSwitch } from "@heroui/react";
import type { ReactNode } from "react";

export interface CheckboxControlProps {
  readonly isSelected: boolean;
  readonly onChange: (selected: boolean) => void;
  readonly label?: ReactNode | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly className?: string | undefined;
}

export function CheckboxControl({
  isSelected,
  onChange,
  label,
  isDisabled = false,
  className = "",
}: CheckboxControlProps) {
  return (
    <HeroCheckbox
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      className={className}
    >
      <HeroCheckbox.Control>
        <HeroCheckbox.Indicator />
      </HeroCheckbox.Control>
      {label ? (
        <HeroCheckbox.Content>
          <Label className="text-xs text-zinc-200">{label}</Label>
        </HeroCheckbox.Content>
      ) : null}
    </HeroCheckbox>
  );
}

export interface SwitchControlProps {
  readonly isSelected: boolean;
  readonly onChange: (selected: boolean) => void;
  readonly label?: ReactNode | undefined;
  readonly labelClassName?: string | undefined;
  readonly labelPosition?: "left" | "right" | undefined;
  readonly color?: "default" | "accent" | "success" | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly size?: "sm" | "md" | "lg" | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
}

export function SwitchControl({
  isSelected,
  onChange,
  label,
  labelClassName = "text-xs text-zinc-200",
  labelPosition = "right",
  color = "accent",
  isDisabled = false,
  size = "sm",
  ariaLabel,
  className = "",
}: SwitchControlProps) {
  const controlColorClass =
    color === "success" && isSelected
      ? "!bg-emerald-500"
      : color === "default" && !isSelected
        ? "bg-zinc-700"
        : "";

  return (
    <HeroSwitch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      size={size}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      className={`inline-flex ${className}`}
    >
      <HeroSwitch.Content
        className={`inline-flex cursor-pointer items-center gap-2.5 py-1 select-none ${
          labelPosition === "left" ? "flex-row-reverse" : ""
        }`}
      >
        <HeroSwitch.Control className={controlColorClass}>
          <HeroSwitch.Thumb />
        </HeroSwitch.Control>
        {label ? <Label className={`cursor-pointer ${labelClassName}`}>{label}</Label> : null}
      </HeroSwitch.Content>
    </HeroSwitch>
  );
}
