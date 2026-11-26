"use client";

import { Tabs as HeroTabs } from "@heroui/react";
import type { ReactNode } from "react";

export interface StudioTabItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly content?: ReactNode | undefined;
}

export interface StudioTabsProps {
  readonly selectedKey: string;
  readonly onSelectionChange: (key: string) => void;
  readonly items: ReadonlyArray<StudioTabItem>;
  readonly orientation?: "horizontal" | "vertical" | undefined;
  readonly variant?: "primary" | "secondary" | undefined;
  readonly ariaLabel?: string | undefined;
  readonly className?: string | undefined;
}

export function StudioTabs({
  selectedKey,
  onSelectionChange,
  items,
  orientation = "horizontal",
  variant = "primary",
  ariaLabel = "Điều hướng tab",
  className = "",
}: StudioTabsProps) {
  return (
    <HeroTabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => {
        onSelectionChange(String(key));
      }}
      orientation={orientation}
      variant={variant}
      className={className}
    >
      <HeroTabs.ListContainer>
        <HeroTabs.List aria-label={ariaLabel}>
          {items.map((item) => (
            <HeroTabs.Tab key={item.id} id={item.id}>
              {item.label}
              <HeroTabs.Indicator />
            </HeroTabs.Tab>
          ))}
        </HeroTabs.List>
      </HeroTabs.ListContainer>
      {items.map((item) =>
        item.content !== undefined ? (
          <HeroTabs.Panel key={item.id} id={item.id}>
            {item.content}
          </HeroTabs.Panel>
        ) : null,
      )}
    </HeroTabs>
  );
}
