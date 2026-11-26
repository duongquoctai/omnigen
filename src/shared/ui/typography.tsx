"use client";

import { Kbd } from "@heroui/react";
import type { ReactNode } from "react";

export type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps {
  readonly level?: HeadingLevel | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

const HEADING_CLASSES: Record<HeadingLevel, string> = {
  1: "text-xl font-bold tracking-tight text-white",
  2: "text-base font-semibold tracking-tight text-white",
  3: "text-sm font-semibold text-zinc-100",
  4: "text-xs font-semibold uppercase tracking-wider text-zinc-300",
};

export function Heading({ level = 2, className = "", children }: HeadingProps) {
  const combined = `${HEADING_CLASSES[level]} ${className}`.trim();
  if (level === 1) return <h1 className={combined}>{children}</h1>;
  if (level === 3) return <h3 className={combined}>{children}</h3>;
  if (level === 4) return <h4 className={combined}>{children}</h4>;
  return <h2 className={combined}>{children}</h2>;
}

export type TextVariant = "body" | "caption" | "muted" | "mono" | "label";

export interface TextProps {
  readonly variant?: TextVariant | undefined;
  readonly as?: "p" | "span" | "div" | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

const TEXT_CLASSES: Record<TextVariant, string> = {
  body: "text-sm text-zinc-200",
  caption: "text-xs text-zinc-400",
  muted: "text-xs text-zinc-500",
  mono: "font-mono text-xs text-zinc-300",
  label: "text-xs font-medium text-zinc-300",
};

export function Text({ variant = "body", as = "span", className = "", children }: TextProps) {
  const combined = `${TEXT_CLASSES[variant]} ${className}`.trim();
  if (as === "p") return <p className={combined}>{children}</p>;
  if (as === "div") return <div className={combined}>{children}</div>;
  return <span className={combined}>{children}</span>;
}

export interface KbdChipProps {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function KbdChip({ children, className = "" }: KbdChipProps) {
  return (
    <Kbd className={`border border-zinc-700 bg-zinc-900 text-zinc-200 ${className}`.trim()}>
      <Kbd.Content>{children}</Kbd.Content>
    </Kbd>
  );
}
