"use client";

import { Button as HeroButton, type ButtonProps as HeroButtonProps } from "@heroui/react";
import type { ReactNode } from "react";

export type ButtonProps = HeroButtonProps & {
  readonly isLoading?: boolean;
};

const VARIANT_CLASSES: NonNullable<Record<NonNullable<HeroButtonProps["variant"]>, string>> = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500 border border-indigo-500/60",
  secondary: "bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-700/80",
  tertiary: "bg-zinc-800/70 text-zinc-200 hover:bg-zinc-800 border border-zinc-700/60",
  outline: "bg-transparent text-zinc-200 hover:bg-zinc-800/60 border border-zinc-700",
  ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800/60 hover:text-white",
  danger: "bg-rose-600 text-white hover:bg-rose-500 border border-rose-500/60",
  "danger-soft": "bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30",
};

export function Button({
  isLoading,
  isDisabled,
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const variantClass = VARIANT_CLASSES[variant];
  return (
    <HeroButton
      variant={variant}
      isDisabled={Boolean(isDisabled) || Boolean(isLoading)}
      className={`${variantClass} ${String(className)}`.trim()}
      {...props}
    >
      {children}
    </HeroButton>
  );
}

export type IconButtonProps = Omit<ButtonProps, "isIconOnly"> & {
  readonly "aria-label": string;
  readonly children: ReactNode;
};

export function IconButton({ children, ...props }: IconButtonProps) {
  return (
    <Button isIconOnly {...props}>
      {children}
    </Button>
  );
}
