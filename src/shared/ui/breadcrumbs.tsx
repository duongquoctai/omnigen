"use client";

import { Breadcrumbs as HeroBreadcrumbs } from "@heroui/react";
import type { ReactNode } from "react";

export interface StudioBreadcrumbItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly href?: string | undefined;
  readonly onPress?: (() => void) | undefined;
}

export interface StudioBreadcrumbsProps {
  readonly items: ReadonlyArray<StudioBreadcrumbItem>;
  readonly className?: string | undefined;
}

export function StudioBreadcrumbs({ items, className = "" }: StudioBreadcrumbsProps) {
  return (
    <HeroBreadcrumbs className={className}>
      {items.map((item) => (
        <HeroBreadcrumbs.Item
          key={item.id}
          {...(item.href ? { href: item.href } : {})}
          {...(item.onPress ? { onPress: item.onPress } : {})}
        >
          {item.label}
        </HeroBreadcrumbs.Item>
      ))}
    </HeroBreadcrumbs>
  );
}
