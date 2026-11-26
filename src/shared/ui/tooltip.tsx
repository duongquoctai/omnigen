"use client";

import { Tooltip as HeroTooltip } from "@heroui/react";
import type { ReactNode } from "react";

export interface StudioTooltipProps {
  readonly content: ReactNode;
  readonly children: ReactNode;
}

export function StudioTooltip({ content, children }: StudioTooltipProps) {
  return (
    <HeroTooltip delay={300}>
      <HeroTooltip.Trigger>{children}</HeroTooltip.Trigger>
      <HeroTooltip.Content className="border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100">
        {content}
      </HeroTooltip.Content>
    </HeroTooltip>
  );
}
