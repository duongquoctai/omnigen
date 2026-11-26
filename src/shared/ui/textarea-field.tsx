"use client";

import { Label, TextArea, TextField } from "@heroui/react";

export interface TextAreaFieldProps {
  readonly label?: string | undefined;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string | undefined;
  readonly rows?: number | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
}

export function TextAreaField({
  label,
  value,
  onValueChange,
  placeholder,
  rows = 3,
  isDisabled = false,
  ariaLabel,
  className = "",
}: TextAreaFieldProps) {
  return (
    <TextField
      value={value}
      onChange={onValueChange}
      isDisabled={isDisabled}
      aria-label={ariaLabel ?? label ?? placeholder ?? "Nội dung"}
      className={className}
    >
      {label ? <Label className="text-xs font-medium text-zinc-300">{label}</Label> : null}
      <TextArea
        rows={rows}
        placeholder={placeholder}
        className="border-zinc-800 bg-zinc-900 text-xs text-zinc-100"
      />
    </TextField>
  );
}
