"use client";

import { Alert as HeroAlert } from "@heroui/react";
import type { ReactNode } from "react";

export type AlertStatus = "default" | "accent" | "success" | "warning" | "danger";

export interface AlertBannerProps {
  readonly status?: AlertStatus | undefined;
  readonly title?: string | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function AlertBanner({
  status = "default",
  title,
  className = "",
  children,
}: AlertBannerProps) {
  return (
    <HeroAlert
      status={status}
      role={status === "danger" ? "alert" : "status"}
      className={className}
    >
      <HeroAlert.Indicator />
      <HeroAlert.Content>
        {title ? <HeroAlert.Title>{title}</HeroAlert.Title> : null}
        <HeroAlert.Description>{children}</HeroAlert.Description>
      </HeroAlert.Content>
    </HeroAlert>
  );
}
