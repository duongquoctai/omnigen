"use client";

import { Avatar as HeroAvatar, Dropdown as HeroDropdown, Label } from "@heroui/react";
import type { ReactNode } from "react";

export interface UserMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode | undefined;
  readonly isDanger?: boolean | undefined;
  readonly onAction: () => void;
}

export interface UserMenuDropdownProps {
  readonly name: string;
  readonly initials: string;
  readonly avatarUrl?: string | undefined;
  readonly items: ReadonlyArray<UserMenuItem>;
  readonly headerContent?: ReactNode | undefined;
}

export function UserMenuDropdown({
  name,
  initials,
  avatarUrl,
  items,
  headerContent,
}: UserMenuDropdownProps) {
  return (
    <HeroDropdown>
      <HeroDropdown.Trigger
        aria-label="Menu tài khoản"
        className="rounded-full p-0.5 transition hover:ring-2 hover:ring-indigo-400/50"
      >
        <HeroAvatar size="sm" color="accent" variant="soft">
          {avatarUrl ? <HeroAvatar.Image src={avatarUrl} alt={name} /> : null}
          <HeroAvatar.Fallback>{initials}</HeroAvatar.Fallback>
        </HeroAvatar>
      </HeroDropdown.Trigger>
      <HeroDropdown.Popover className="min-w-52 border border-zinc-800 bg-zinc-950 text-zinc-100">
        {headerContent ? (
          <div className="border-b border-zinc-800 px-3 py-2">{headerContent}</div>
        ) : null}
        <HeroDropdown.Menu
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
            >
              {item.icon}
              <Label>{item.label}</Label>
            </HeroDropdown.Item>
          ))}
        </HeroDropdown.Menu>
      </HeroDropdown.Popover>
    </HeroDropdown>
  );
}
