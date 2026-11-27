"use client";

import { Film } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useActionForm } from "@/shared/hooks/use-action-form";
import { AlertBanner, Button, FormField, Heading, Text, TextInput } from "@/shared/ui";

import { RegisterInput } from "../domain/auth";
import { loginAction, registerAction } from "./actions";
import { AuthIntroPanel } from "./auth-intro-panel";
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
      <Button type="submit" fullWidth variant="primary" isLoading={isSubmitting} className="mt-2">
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
    <div className="grid min-h-screen w-full grid-cols-1 bg-[#09090f] lg:grid-cols-2">
      <div className="hidden p-4 lg:flex">
        <AuthIntroPanel />
      </div>

      <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center space-y-3 text-center">
            <div className="flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-500 shadow-lg shadow-indigo-500/20">
                <Film className="h-5 w-5 text-white" />
              </div>
              <Text variant="body" className="text-xl font-extrabold tracking-tight text-white">
                OmniGen
              </Text>
            </div>

            <div className="space-y-1">
              <Heading level={1} className="text-2xl font-bold tracking-tight text-white">
                {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
              </Heading>
              <Text variant="caption" as="div" className="text-sm text-zinc-400">
                {mode === "login"
                  ? "Nhập thông tin tài khoản để truy cập studio"
                  : "Tạo tài khoản mới để bắt đầu quản lý dự án"}
              </Text>
            </div>
          </div>

          {mode === "login" ? (
            <LoginForm onLogin={loginAction} onSuccess={handleSuccess} />
          ) : (
            <RegisterForm onSuccess={handleSuccess} />
          )}

          <div className="flex items-center justify-center gap-1 pt-1 text-center">
            <Text variant="caption" className="text-xs text-zinc-400">
              {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
            </Text>
            <Button
              size="sm"
              variant="ghost"
              className="h-auto min-w-0 border-0 bg-transparent px-1 py-0 text-xs font-semibold text-indigo-400 hover:bg-transparent hover:text-indigo-300"
              onPress={() => {
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "Tạo tài khoản" : "Đăng nhập"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
