"use client";

import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import type { Schema } from "effect";
import { useState } from "react";
import {
  type DefaultValues,
  type FieldValues,
  type Path,
  useForm,
  type UseFormReturn,
} from "react-hook-form";

import type { ActionResult } from "@/shared/types/action";

export interface UseActionFormOptions<TFieldValues extends FieldValues, TOutput, TResult> {
  readonly schema: Schema.Codec<TOutput, TFieldValues, never, unknown>;
  readonly defaultValues: DefaultValues<TFieldValues>;
  readonly action: (input: TOutput) => Promise<ActionResult<TResult>>;
  readonly onSuccess?: ((data: TResult) => void | Promise<void>) | undefined;
}

export interface UseActionFormReturn<TFieldValues extends FieldValues> {
  readonly form: UseFormReturn<TFieldValues>;
  readonly serverError: string | null;
  readonly isSubmitting: boolean;
  readonly onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  readonly clearServerError: () => void;
}

export function useActionForm<TFieldValues extends FieldValues, TOutput, TResult>({
  schema,
  defaultValues,
  action,
  onSuccess,
}: UseActionFormOptions<TFieldValues, TOutput, TResult>): UseActionFormReturn<TFieldValues> {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<TFieldValues>({
    defaultValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    resolver: effectTsResolver(schema) as any,
  });

  const handleValidSubmit = async (values: TFieldValues) => {
    setServerError(null);
    const result = await action(values as unknown as TOutput);
    if (result.ok) {
      await onSuccess?.(result.data);
      return;
    }

    setServerError(result.error);
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        form.setError(field as Path<TFieldValues>, { type: "server", message });
      }
    }
  };

  return {
    form,
    serverError,
    isSubmitting: form.formState.isSubmitting,
    onSubmit: form.handleSubmit(handleValidSubmit),
    clearServerError: () => {
      setServerError(null);
    },
  };
}
