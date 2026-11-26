"use client";

import { Input, type InputProps, Label } from "@heroui/react";
import { type ReactNode, useId } from "react";

export interface FormFieldProps {
  readonly label: string;
  readonly error?: string | undefined;
  readonly isRequired?: boolean | undefined;
  readonly children: ReactNode;
}

export function FormField({ label, error, isRequired, children }: FormFieldProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5" data-invalid={Boolean(error) || undefined}>
      <Label htmlFor={id} isRequired={Boolean(isRequired)}>
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextInputProps = InputProps;

export function TextInput(props: TextInputProps) {
  return <Input {...props} />;
}
