"use client";

import { Film, History, Layers } from "lucide-react";
import type { ReactNode } from "react";

import { Button, CheckboxControl, Heading, Text } from "@/shared/ui";

import {
  MODULE_ACTIONS,
  type ModuleAction,
  type ModulePermissions,
  type StudioModule,
} from "../domain/permissions";
import { toggleModuleAction, toggleModuleEnabled } from "../domain/sharing";

export const SHARE_MODULE_META: ReadonlyArray<{
  readonly key: StudioModule;
  readonly title: string;
  readonly icon: ReactNode;
  readonly desc: string;
}> = [
  {
    key: "split",
    title: "Tách cảnh video",
    icon: <Film className="h-4 w-4 text-rose-400" />,
    desc: "Xem video gốc, tải cảnh cắt, hoặc chỉnh sửa mốc giây & tách scene",
  },
  {
    key: "mix",
    title: "Trộn video & kho clip",
    icon: <Layers className="h-4 w-4 text-indigo-400" />,
    desc: "Xem kho clip 5 category, bấm trộn tổ hợp và tải file MP4/ZIP",
  },
  {
    key: "history",
    title: "Lịch sử render",
    icon: <History className="h-4 w-4 text-emerald-400" />,
    desc: "Xem danh sách video, tải video MP4, bật/tắt trạng thái sử dụng hoặc xoá",
  },
];

const ACTION_LABELS: Record<ModuleAction, string> = {
  view: "Xem",
  export: "Tải / xuất",
  edit: "Chỉnh sửa",
};

export interface SharePermissionMatrixProps {
  readonly permissions: ModulePermissions;
  readonly onChange: (next: ModulePermissions) => void;
}

export function SharePermissionMatrix({ permissions, onChange }: SharePermissionMatrixProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300">
        <span>Ma trận quyền theo từng module:</span>
        <span className="text-[11px] font-normal text-slate-500">
          (Cấp quyền chỉnh sửa sẽ cho phép tạo/xoá thư mục con)
        </span>
      </div>

      <div className="divide-y divide-slate-800/80 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
        {SHARE_MODULE_META.map((mod) => {
          const modPerm = permissions[mod.key];
          const isEnabled = modPerm._tag === "Enabled";
          const activeActions: ReadonlyArray<ModuleAction> =
            modPerm._tag === "Enabled" ? modPerm.actions : [];

          return (
            <div
              key={mod.key}
              className={`p-3.5 transition sm:p-4 ${isEnabled ? "bg-slate-900/40" : "opacity-60"}`}
            >
              <div className="space-y-3">
                <div className="flex min-w-0 items-start gap-3">
                  <CheckboxControl
                    isSelected={isEnabled}
                    onChange={() => {
                      onChange(toggleModuleEnabled(permissions, mod.key));
                    }}
                    aria-label={`Bật hoặc tắt quyền ${mod.title}`}
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      {mod.icon}
                      <Heading level={4}>{mod.title}</Heading>
                    </div>
                    <Text
                      variant="caption"
                      as="div"
                      className="text-[11px] leading-relaxed text-slate-400"
                    >
                      {mod.desc}
                    </Text>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-800/60 pt-2">
                  {MODULE_ACTIONS.map((action) => {
                    const isChecked = isEnabled && activeActions.includes(action);
                    return (
                      <Button
                        key={action}
                        size="sm"
                        variant={isChecked ? "primary" : "secondary"}
                        onPress={() => {
                          onChange(toggleModuleAction(permissions, mod.key, action));
                        }}
                      >
                        {ACTION_LABELS[action]}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
