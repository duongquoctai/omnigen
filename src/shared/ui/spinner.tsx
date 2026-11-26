"use client";

import { Spinner as HeroSpinner, type SpinnerProps as HeroSpinnerProps } from "@heroui/react";

export type SpinnerProps = HeroSpinnerProps;

export function Spinner(props: SpinnerProps) {
  return <HeroSpinner {...props} />;
}
