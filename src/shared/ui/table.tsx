"use client";

import { Table as HeroTable } from "@heroui/react";
import type { ReactNode } from "react";

export interface StudioTableColumnDef {
  readonly id: string;
  readonly label: string;
  readonly align?: "left" | "center" | "right" | undefined;
  readonly isRowHeader?: boolean | undefined;
  readonly className?: string | undefined;
}

export interface StudioTableProps {
  readonly ariaLabel: string;
  readonly columns: ReadonlyArray<StudioTableColumnDef>;
  readonly children: ReactNode;
  readonly footer?: ReactNode | undefined;
  readonly className?: string | undefined;
  readonly contentClassName?: string | undefined;
}

const ALIGN_CLASS: Record<"left" | "center" | "right", string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function StudioTable({
  ariaLabel,
  columns,
  children,
  footer,
  className = "",
  contentClassName = "min-w-[920px]",
}: StudioTableProps) {
  return (
    <HeroTable
      variant="primary"
      className={`overflow-hidden rounded-2xl border border-zinc-800/90 !bg-[#0b0d18] ${className}`}
    >
      <HeroTable.ScrollContainer className="!bg-transparent">
        <HeroTable.Content
          aria-label={ariaLabel}
          className={`w-full border-collapse !bg-transparent ${contentClassName}`}
        >
          <HeroTable.Header className="border-b border-zinc-800/80 !bg-[#070912]">
            {columns.map((col) => (
              <HeroTable.Column
                key={col.id}
                id={col.id}
                {...(col.isRowHeader ? { isRowHeader: true } : {})}
                className={`px-4 py-3 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase ${ALIGN_CLASS[col.align ?? "left"]} ${col.className ?? ""}`}
              >
                {col.label}
              </HeroTable.Column>
            ))}
          </HeroTable.Header>
          <HeroTable.Body className="divide-y divide-zinc-800/70 !bg-transparent">
            {children}
          </HeroTable.Body>
        </HeroTable.Content>
      </HeroTable.ScrollContainer>
      {footer ? (
        <HeroTable.Footer className="w-full border-t border-zinc-800/80 !bg-[#070912]/70 px-4 py-3">
          {footer}
        </HeroTable.Footer>
      ) : null}
    </HeroTable>
  );
}

export interface StudioTableRowProps {
  readonly id: string;
  readonly isSelected?: boolean | undefined;
  readonly onAction?: (() => void) | undefined;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

export function StudioTableRow({
  id,
  isSelected = false,
  onAction,
  children,
  className = "",
}: StudioTableRowProps) {
  return (
    <HeroTable.Row
      id={id}
      {...(onAction ? { onAction } : {})}
      className={`cursor-pointer !bg-transparent transition-colors hover:!bg-zinc-900/50 ${
        isSelected ? "!bg-indigo-500/10" : ""
      } ${className}`}
    >
      {children}
    </HeroTable.Row>
  );
}

export interface StudioTableCellProps {
  readonly children: ReactNode;
  readonly align?: "left" | "center" | "right" | undefined;
  readonly className?: string | undefined;
}

export function StudioTableCell({
  children,
  align = "left",
  className = "",
}: StudioTableCellProps) {
  return (
    <HeroTable.Cell
      className={`!bg-transparent px-4 py-3 align-middle ${ALIGN_CLASS[align]} ${className}`}
    >
      {children}
    </HeroTable.Cell>
  );
}
