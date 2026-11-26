"use client";

import { Film } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useActionForm } from "@/shared/hooks/use-action-form";
import { AlertBanner, Button, FormField, Heading, Text, TextInput } from "@/shared/ui";

import { RegisterInput } from "../domain/auth";
import { loginAction, registerAction } from "./actions";
import { LoginForm } from "./login-form";

export interface AuthScreenProps {
  readonly callbackUrl: string;
}

function RegisterForm({ onSuccess }: { readonly onSuccess: () => void }) {
  const { form, serverError, isSubmitting, onSubmit } = useActionForm({
    schema: RegisterInput,
    defaultValues: { name: "", email: "", password: "" },
    action: registerAction,
    onSuccess,
  });

  const { errors } = form.formState;

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      className="space-y-4"
    >
      <FormField label="Họ và tên" error={errors.name?.message} isRequired>
        <TextInput placeholder="Nguyễn Văn A" {...form.register("name")} />
      </FormField>
      <FormField label="Email" error={errors.email?.message} isRequired>
        <TextInput type="email" placeholder="ten@congty.com" {...form.register("email")} />
      </FormField>
      <FormField label="Mật khẩu (tối thiểu 6 ký tự)" error={errors.password?.message} isRequired>
        <TextInput type="password" placeholder="••••••••" {...form.register("password")} />
      </FormField>
      {serverError ? <AlertBanner status="danger">{serverError}</AlertBanner> : null}
      <Button type="submit" fullWidth variant="primary" isLoading={isSubmitting}>
        Tạo tài khoản
      </Button>
    </form>
  );
}

export function AuthScreen({ callbackUrl }: AuthScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleSuccess = () => {
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="relative w-full max-w-md space-y-6 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-2xl backdrop-blur-md">
      <div className="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-500 shadow-lg shadow-rose-500/20">
          <Film className="h-6 w-6 text-white" />
        </div>
        <Heading level={1} className="font-extrabold">
          OmniGen
        </Heading>
        <Text variant="caption" as="div" className="text-slate-400">
          {mode === "login"
            ? "Đăng nhập để quản lý dự án & kho video"
            : "Tạo tài khoản mới để bắt đầu làm việc"}
        </Text>
      </div>

      <div className="flex rounded-2xl border border-slate-800 bg-slate-950 p-1 text-xs">
        <Button
          size="sm"
          fullWidth
          variant={mode === "login" ? "primary" : "ghost"}
          onPress={() => {
            setMode("login");
          }}
        >
          Đăng nhập
        </Button>
        <Button
          size="sm"
          fullWidth
          variant={mode === "register" ? "primary" : "ghost"}
          onPress={() => {
            setMode("register");
          }}
        >
          Đăng ký tài khoản
        </Button>
      </div>

      {mode === "login" ? (
        <LoginForm onLogin={loginAction} onSuccess={handleSuccess} />
      ) : (
        <RegisterForm onSuccess={handleSuccess} />
      )}
    </div>
  );
}
