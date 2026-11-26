"use client";

import { Schema } from "effect";

import { useActionForm } from "@/shared/hooks/use-action-form";
import type { ActionResult } from "@/shared/types/action";
import { AlertBanner, Button, FormField, Heading, TextInput } from "@/shared/ui";

export const DiversityRulesFormSchema = Schema.Struct({
  targetCount: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
  targetOutputDuration: Schema.NumberFromString.check(Schema.isGreaterThan(0)),
  minHammingDistance: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 5 }),
  ),
  maxShotFrequency: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThan(0)),
  seed: Schema.NumberFromString.check(Schema.isInt()),
});

export type DiversityRulesFormValues = {
  readonly targetCount: string;
  readonly targetOutputDuration: string;
  readonly minHammingDistance: string;
  readonly maxShotFrequency: string;
  readonly seed: string;
};

export type DiversityRulesFormOutput = typeof DiversityRulesFormSchema.Type;

export interface DiversityRulesFormProps {
  readonly canEdit: boolean;
  readonly onPlanMix: (values: DiversityRulesFormOutput) => Promise<ActionResult<unknown>>;
}

export function DiversityRulesForm({ canEdit, onPlanMix }: DiversityRulesFormProps) {
  const { form, serverError, isSubmitting, onSubmit } = useActionForm<
    DiversityRulesFormValues,
    DiversityRulesFormOutput,
    unknown
  >({
    schema: DiversityRulesFormSchema,
    defaultValues: {
      targetCount: "10",
      targetOutputDuration: "20",
      minHammingDistance: "2",
      maxShotFrequency: "5",
      seed: "42",
    },
    action: onPlanMix,
  });

  const { errors } = form.formState;

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
    >
      <Heading level={3}>Cấu hình phối trộn video</Heading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <FormField label="Số lượng video" error={errors.targetCount?.message}>
          <TextInput {...form.register("targetCount")} />
        </FormField>
        <FormField label="Thời lượng đích (giây)" error={errors.targetOutputDuration?.message}>
          <TextInput {...form.register("targetOutputDuration")} />
        </FormField>
        <FormField label="Hamming tối thiểu" error={errors.minHammingDistance?.message}>
          <TextInput {...form.register("minHammingDistance")} />
        </FormField>
        <FormField label="Tần suất lặp tối đa" error={errors.maxShotFrequency?.message}>
          <TextInput {...form.register("maxShotFrequency")} />
        </FormField>
        <FormField label="Seed ngẫu nhiên" error={errors.seed?.message}>
          <TextInput {...form.register("seed")} />
        </FormField>
      </div>
      {serverError ? <AlertBanner status="danger">{serverError}</AlertBanner> : null}
      <Button
        type="submit"
        size="sm"
        variant="primary"
        isLoading={isSubmitting}
        isDisabled={!canEdit}
      >
        Lên kế hoạch phối trộn
      </Button>
    </form>
  );
}
