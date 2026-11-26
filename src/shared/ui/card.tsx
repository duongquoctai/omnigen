"use client";

import { Card as HeroCard, Surface as HeroSurface } from "@heroui/react";
import type { ReactNode } from "react";

export interface StudioCardProps {
  readonly title?: ReactNode | undefined;
  readonly description?: ReactNode | undefined;
  readonly headerAction?: ReactNode | undefined;
  readonly footer?: ReactNode | undefined;
  readonly variant?: "default" | "secondary" | "tertiary" | "transparent" | undefined;
  readonly className?: string | undefined;
  readonly bodyClassName?: string | undefined;
  readonly children: ReactNode;
}

export function StudioCard({
  title,
  description,
  headerAction,
  footer,
  variant = "default",
  className = "",
  bodyClassName = "",
  children,
}: StudioCardProps) {
  const hasHeader = Boolean(title) || Boolean(description) || Boolean(headerAction);
  return (
    <HeroCard
      variant={variant}
      className={`rounded-2xl border border-zinc-800/90 bg-zinc-950/75 text-zinc-100 ${className}`.trim()}
    >
      {hasHeader ? (
        <HeroCard.Header className="flex flex-row items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {title ? (
              <HeroCard.Title className="text-sm font-semibold text-white">{title}</HeroCard.Title>
            ) : null}
            {description ? (
              <HeroCard.Description className="text-xs text-zinc-400">
                {description}
              </HeroCard.Description>
            ) : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </HeroCard.Header>
      ) : null}
      <HeroCard.Content className={bodyClassName}>{children}</HeroCard.Content>
      {footer ? <HeroCard.Footer>{footer}</HeroCard.Footer> : null}
    </HeroCard>
  );
}

export interface SurfaceBoxProps {
  readonly variant?: "default" | "secondary" | "tertiary" | "transparent" | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function SurfaceBox({ variant = "secondary", className = "", children }: SurfaceBoxProps) {
  return (
    <HeroSurface
      variant={variant}
      className={`rounded-xl border border-zinc-800/80 ${className}`.trim()}
    >
      {children}
    </HeroSurface>
  );
}
