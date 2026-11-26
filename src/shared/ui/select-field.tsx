"use client";

import { Label, ListBox, Select as HeroSelect } from "@heroui/react";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string | undefined;
}

export interface SelectFieldProps {
  readonly label?: string | undefined;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: ReadonlyArray<SelectOption>;
  readonly placeholder?: string | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
}

export function SelectField({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Chọn...",
  isDisabled = false,
  ariaLabel,
  className = "",
}: SelectFieldProps) {
  return (
    <HeroSelect
      value={value}
      onChange={(key) => {
        if (key !== null) {
          onValueChange(String(key));
        }
      }}
      placeholder={placeholder}
      isDisabled={isDisabled}
      aria-label={ariaLabel ?? label ?? placeholder}
      className={className}
    >
      {label ? <Label className="text-xs font-medium text-zinc-300">{label}</Label> : null}
      <HeroSelect.Trigger className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover className="border border-zinc-800 bg-zinc-950 text-zinc-100">
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
              {opt.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}
