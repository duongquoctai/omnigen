"use client";

import { EmptyState as HeroEmptyState } from "@heroui/react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <HeroEmptyState
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-6 py-10 text-center ${className ?? ""}`}
    >
      {icon ? <div className="text-zinc-400">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        {description ? <p className="text-xs text-zinc-400">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </HeroEmptyState>
  );
}
