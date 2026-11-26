"use client";

import { Description, Dropdown as HeroDropdown, Label } from "@heroui/react";
import type { ReactNode } from "react";

export interface ActionMenuItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string | undefined;
  readonly icon?: ReactNode | undefined;
  readonly isDanger?: boolean | undefined;
  readonly isDisabled?: boolean | undefined;
  readonly onAction: () => void;
}

export interface ActionMenuDropdownProps {
  readonly trigger: ReactNode;
  readonly ariaLabel: string;
  readonly items: ReadonlyArray<ActionMenuItem>;
  readonly isDisabled?: boolean | undefined;
  readonly triggerClassName?: string | undefined;
  readonly popoverClassName?: string | undefined;
}

export function ActionMenuDropdown({
  trigger,
  ariaLabel,
  items,
  isDisabled = false,
  triggerClassName = "",
  popoverClassName = "min-w-52 border border-zinc-800 bg-[#0d1020] text-zinc-100 shadow-2xl",
}: ActionMenuDropdownProps) {
  const disabledKeys = items.filter((i) => i.isDisabled).map((i) => i.id);

  return (
    <HeroDropdown>
      <HeroDropdown.Trigger
        aria-label={ariaLabel}
        isDisabled={isDisabled}
        className={triggerClassName}
      >
        {trigger}
      </HeroDropdown.Trigger>
      <HeroDropdown.Popover className={popoverClassName}>
        <HeroDropdown.Menu
          disabledKeys={disabledKeys}
          onAction={(key) => {
            const matched = items.find((item) => item.id === String(key));
            matched?.onAction();
          }}
        >
          {items.map((item) => (
            <HeroDropdown.Item
              key={item.id}
              id={item.id}
              variant={item.isDanger ? "danger" : "default"}
              textValue={item.label}
              className="py-2"
            >
              {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
              <div className="flex flex-col">
                <Label className="text-xs font-medium text-zinc-100">{item.label}</Label>
                {item.description ? (
                  <Description className="text-[10px] text-zinc-400">
                    {item.description}
                  </Description>
                ) : null}
              </div>
            </HeroDropdown.Item>
          ))}
        </HeroDropdown.Menu>
      </HeroDropdown.Popover>
    </HeroDropdown>
  );
}
