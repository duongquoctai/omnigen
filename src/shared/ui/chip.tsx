"use client";

import { Badge as HeroBadge, Chip as HeroChip } from "@heroui/react";
import type { ReactNode } from "react";

export type ChipColor = "default" | "accent" | "success" | "warning" | "danger";
export type ChipVariant = "primary" | "secondary" | "soft" | "tertiary";
export type ChipSize = "sm" | "md" | "lg";

export interface StatusChipProps {
  readonly color?: ChipColor | undefined;
  readonly variant?: ChipVariant | undefined;
  readonly size?: ChipSize | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function StatusChip({
  color = "default",
  variant = "soft",
  size = "sm",
  className = "",
  children,
}: StatusChipProps) {
  return (
    <HeroChip color={color} variant={variant} size={size} className={className}>
      <HeroChip.Label>{children}</HeroChip.Label>
    </HeroChip>
  );
}

export interface BadgeCountProps {
  readonly count: number | string;
  readonly color?: ChipColor | undefined;
  readonly size?: ChipSize | undefined;
  readonly children: ReactNode;
}

export function BadgeCount({ count, color = "accent", size = "sm", children }: BadgeCountProps) {
  return (
    <HeroBadge.Anchor>
      {children}
      <HeroBadge color={color} size={size} placement="top-right">
        <HeroBadge.Label>{count}</HeroBadge.Label>
      </HeroBadge>
    </HeroBadge.Anchor>
  );
}
