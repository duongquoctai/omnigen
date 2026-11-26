"use client";

import { Drawer as HeroDrawer } from "@heroui/react";
import type { ReactNode } from "react";

export interface StudioDrawerProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly placement?: "left" | "right" | "top" | "bottom" | undefined;
  readonly dialogClassName?: string | undefined;
  readonly footer?: ReactNode | undefined;
  readonly children: ReactNode;
}

export function StudioDrawer({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  placement = "left",
  dialogClassName = "",
  footer,
  children,
}: StudioDrawerProps) {
  return (
    <HeroDrawer isOpen={isOpen} onOpenChange={onOpenChange}>
      <HeroDrawer.Backdrop>
        <HeroDrawer.Content placement={placement}>
          <HeroDrawer.Dialog
            className={`border-zinc-800 bg-zinc-950 text-zinc-100 ${
              placement === "right" ? "border-l" : "border-r"
            } ${dialogClassName}`}
          >
            <HeroDrawer.CloseTrigger />
            <HeroDrawer.Header>
              <HeroDrawer.Heading className="text-sm font-semibold text-white">
                {title}
              </HeroDrawer.Heading>
              {subtitle ? <div className="mt-0.5 text-xs text-zinc-400">{subtitle}</div> : null}
            </HeroDrawer.Header>
            <HeroDrawer.Body>{children}</HeroDrawer.Body>
            {footer ? (
              <HeroDrawer.Footer className="border-t border-zinc-800/80 pt-3">
                {footer}
              </HeroDrawer.Footer>
            ) : null}
          </HeroDrawer.Dialog>
        </HeroDrawer.Content>
      </HeroDrawer.Backdrop>
    </HeroDrawer>
  );
}
