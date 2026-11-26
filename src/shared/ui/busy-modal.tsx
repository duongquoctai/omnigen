"use client";

import { Modal as HeroModal } from "@heroui/react";
import { Loader2 } from "lucide-react";

import { ProgressIndicator } from "./progress-indicator";
import { Heading, Text } from "./typography";

export interface BusyProgress {
  readonly current: number;
  readonly total: number;
  readonly percent: number;
  readonly label?: string | undefined;
}

export interface BusyModalProps {
  readonly isOpen: boolean;
  readonly title?: string | undefined;
  readonly message?: string | null | undefined;
  readonly progress?: BusyProgress | null | undefined;
}

export function BusyModal({
  isOpen,
  title = "Đang thực hiện...",
  message,
  progress = null,
}: BusyModalProps) {
  return (
    <HeroModal isOpen={isOpen} onOpenChange={() => {}}>
      <HeroModal.Backdrop isDismissable={false} className="backdrop-blur-md">
        <HeroModal.Container size="sm">
          <HeroModal.Dialog className="relative overflow-hidden border border-zinc-800 bg-[#0b0d18] p-6 text-center text-zinc-100 shadow-2xl">
            <div className="pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-rose-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-indigo-500/15 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="relative my-1 flex items-center justify-center">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-zinc-800 border-t-rose-500" />
                <Loader2 className="absolute h-6 w-6 animate-spin text-rose-400" />
              </div>

              <div className="w-full space-y-1.5">
                <Heading level={3} className="text-base font-semibold tracking-wide text-white">
                  {progress ? "Đang kết xuất video..." : title}
                </Heading>
                {message ? (
                  <Text
                    variant="mono"
                    as="p"
                    className="mx-auto max-w-xs text-xs leading-relaxed text-zinc-300"
                  >
                    {message}
                  </Text>
                ) : null}

                {progress ? (
                  <div className="w-full space-y-2 pt-2">
                    <div className="flex items-center justify-between px-1 font-mono text-xs font-bold">
                      <Text variant="mono" className="text-emerald-400">
                        {progress.current} / {progress.total}
                      </Text>
                      <Text variant="mono" className="font-extrabold text-indigo-400">
                        {progress.percent}%
                      </Text>
                    </div>
                    <ProgressIndicator
                      aria-label={progress.label ?? title}
                      value={progress.percent}
                      showValue={false}
                      size="sm"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
}
