"use client";

import { useActionForm } from "@/shared/hooks/use-action-form";
import type { ActionResult } from "@/shared/types/action";
import { AlertBanner, Button, FormField, TextInput } from "@/shared/ui";

import { LoginInput } from "../domain/auth";

export interface LoginFormProps {
  readonly onLogin: (input: LoginInput) => Promise<ActionResult<unknown>>;
  readonly onSuccess?: () => void;
}

export function LoginForm({ onLogin, onSuccess }: LoginFormProps) {
  const { form, serverError, isSubmitting, onSubmit } = useActionForm({
    schema: LoginInput,
    defaultValues: { email: "", password: "" },
    action: onLogin,
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const { errors } = form.formState;

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      className="space-y-4"
    >
      <FormField label="Email" error={errors.email?.message} isRequired>
        <TextInput type="email" placeholder="ten@congty.com" {...form.register("email")} />
      </FormField>
      <FormField label="Mật khẩu" error={errors.password?.message} isRequired>
        <TextInput type="password" placeholder="••••••••" {...form.register("password")} />
      </FormField>
      {serverError ? <AlertBanner status="danger">{serverError}</AlertBanner> : null}
      <Button type="submit" fullWidth variant="primary" isLoading={isSubmitting}>
        Đăng nhập
      </Button>
    </form>
  );
}
