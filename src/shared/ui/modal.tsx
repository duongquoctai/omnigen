"use client";

import { Modal as HeroModal } from "@heroui/react";
import type { ReactNode } from "react";

import { Button } from "./button";

export interface ModalProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: "sm" | "md" | "lg" | "xl" | "2xl" | "cover" | "full";
}

const CUSTOM_CONTAINER_CLASSES: Readonly<Partial<Record<NonNullable<ModalProps["size"]>, string>>> =
  {
    xl: "w-full sm:w-[min(92vw,42rem)]",
    "2xl": "w-full sm:w-[min(92vw,52rem)]",
  };

const CUSTOM_DIALOG_CLASSES: Readonly<Partial<Record<NonNullable<ModalProps["size"]>, string>>> = {
  xl: "max-w-2xl",
  "2xl": "max-w-4xl",
};

export function Modal({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const heroSize = size === "xl" || size === "2xl" ? "lg" : size;
  const containerClassName = CUSTOM_CONTAINER_CLASSES[size];
  const dialogClassName = CUSTOM_DIALOG_CLASSES[size];

  return (
    <HeroModal isOpen={isOpen} onOpenChange={onOpenChange}>
      <HeroModal.Backdrop>
        <HeroModal.Container
          size={heroSize}
          {...(containerClassName ? { className: containerClassName } : {})}
        >
          <HeroModal.Dialog {...(dialogClassName ? { className: dialogClassName } : {})}>
            <HeroModal.CloseTrigger />
            <HeroModal.Header>
              <HeroModal.Heading>{title}</HeroModal.Heading>
              {description ? <p className="mt-1 text-xs text-zinc-400">{description}</p> : null}
            </HeroModal.Header>
            <HeroModal.Body>{children}</HeroModal.Body>
            {footer ? <HeroModal.Footer>{footer}</HeroModal.Footer> : null}
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
}

export interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly isDestructive?: boolean;
  readonly isLoading?: boolean;
  readonly onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Huỷ",
  isDestructive = false,
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onPress={() => {
              onOpenChange(false);
            }}
            isDisabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "danger" : "primary"}
            isLoading={isLoading}
            onPress={() => {
              void onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-300">{description}</p>
    </Modal>
  );
}
