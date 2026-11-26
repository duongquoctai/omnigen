"use client";

import { Label, SearchField as HeroSearchField } from "@heroui/react";

export interface SearchInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string | undefined;
  readonly label?: string | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
}

export function SearchInput({
  value,
  onValueChange,
  placeholder = "Tìm kiếm...",
  label,
  ariaLabel,
  className = "",
}: SearchInputProps) {
  return (
    <HeroSearchField
      value={value}
      onChange={onValueChange}
      aria-label={ariaLabel ?? label ?? placeholder}
      className={className}
    >
      {label ? <Label className="text-xs font-medium text-zinc-300">{label}</Label> : null}
      <HeroSearchField.Group className="border-zinc-800 bg-zinc-900 text-zinc-100">
        <HeroSearchField.SearchIcon />
        <HeroSearchField.Input placeholder={placeholder} className="text-xs text-white" />
        <HeroSearchField.ClearButton />
      </HeroSearchField.Group>
    </HeroSearchField>
  );
}
