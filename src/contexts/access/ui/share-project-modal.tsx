"use client";

import { Loader2, Mail, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, EmptyState, Heading, IconButton, Modal, Text, TextInput } from "@/shared/ui";

import type { ModulePermissions } from "../domain/permissions";
import {
  DEFAULT_MODULE_PERMISSIONS,
  filterShareableUsers,
  getUserInitials,
  type ProjectShareItem,
  type ShareableUser,
} from "../domain/sharing";
import { listProjectSharesAction, removeProjectShareAction, shareProjectAction } from "./actions";
import { SHARE_MODULE_META, SharePermissionMatrix } from "./share-permission-matrix";

export interface ShareProjectModalProps {
  readonly isOpen?: boolean;
  readonly projectId: string;
  readonly projectName: string;
  readonly onClose: () => void;
  readonly onToast: (toast: {
    readonly type: "info" | "success" | "error";
    readonly text: string;
  }) => void;
}

export function ShareProjectModal({
  isOpen = true,
  projectId,
  projectName,
  onClose,
  onToast,
}: ShareProjectModalProps) {
  const [shares, setShares] = useState<ReadonlyArray<ProjectShareItem>>([]);
  const [systemUsers, setSystemUsers] = useState<ReadonlyArray<ShareableUser>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [targetEmail, setTargetEmail] = useState<string>("");
  const [permissions, setPermissions] = useState<ModulePermissions>(DEFAULT_MODULE_PERMISSIONS);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deletingShareId, setDeletingShareId] = useState<string | null>(null);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const loadShares = useCallback(async () => {
    setIsLoading(true);
    const result = await listProjectSharesAction({ projectId });
    if (result.ok) {
      setShares(result.data.shares);
      setSystemUsers(result.data.users);
    } else {
      onToast({ type: "error", text: result.error });
    }
    setIsLoading(false);
  }, [projectId, onToast]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void listProjectSharesAction({ projectId }).then((result) => {
      if (!active) return;
      if (result.ok) {
        setShares(result.data.shares);
        setSystemUsers(result.data.users);
      } else {
        onToast({ type: "error", text: result.error });
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen, projectId, onToast]);

  useEffect(() => {
    if (!isAutocompleteOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node)) {
        setIsAutocompleteOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAutocompleteOpen]);

  const sharedEmailsSet = useMemo(
    () => new Set(shares.map((s) => s.sharedWithEmail.toLowerCase().trim())),
    [shares],
  );

  const filteredUsers = useMemo(
    () => filterShareableUsers(systemUsers, sharedEmailsSet, targetEmail),
    [systemUsers, sharedEmailsSet, targetEmail],
  );

  const handleShareSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const email = targetEmail.trim().toLowerCase();
    if (!email) {
      onToast({ type: "error", text: "Vui lòng nhập email người nhận." });
      return;
    }

    setIsSubmitting(true);
    const result = await shareProjectAction({
      projectId,
      email,
      permissions,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      onToast({ type: "error", text: result.error });
      return;
    }

    onToast({
      type: "success",
      text: `Đã cấp quyền chia sẻ thành công cho ${email}.`,
    });
    setTargetEmail("");
    setPermissions(DEFAULT_MODULE_PERMISSIONS);
    void loadShares();
  };

  const handleRemoveShare = async (shareId: string, email: string) => {
    setDeletingShareId(shareId);
    const result = await removeProjectShareAction({ projectId, shareId });
    setDeletingShareId(null);

    if (!result.ok) {
      onToast({ type: "error", text: result.error });
      return;
    }

    onToast({
      type: "success",
      text: `Đã thu hồi quyền chia sẻ của ${email}.`,
    });
    void loadShares();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Chia sẻ dự án: ${projectName}`}
      description="Phân quyền chi tiết theo từng module cho thành viên trong nhóm."
      size="2xl"
    >
      <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-1">
        <form
          onSubmit={(e) => {
            void handleShareSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Text variant="label" className="block text-slate-300">
              Email người nhận <span className="text-rose-400">*</span>
            </Text>
            <div className="ml-1 flex gap-2">
              <div className="relative flex-1" ref={autocompleteRef}>
                <Mail className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <TextInput
                  id="share-target-email"
                  type="email"
                  required
                  value={targetEmail}
                  onFocus={() => {
                    setIsAutocompleteOpen(true);
                  }}
                  onChange={(e) => {
                    setTargetEmail(e.target.value);
                    setIsAutocompleteOpen(true);
                  }}
                  placeholder="thanhvien@example.com"
                  className="pl-10"
                />

                {isAutocompleteOpen && (
                  <div className="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-56 divide-y divide-slate-800/60 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2 p-3 text-xs text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                        <span>Đang tải danh sách thành viên...</span>
                      </div>
                    ) : filteredUsers.length > 0 ? (
                      <>
                        <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                          Thành viên trong hệ thống ({filteredUsers.length})
                        </div>
                        <div className="space-y-0.5 pt-1">
                          {filteredUsers.map((user) => (
                            <Button
                              key={user.id}
                              variant="ghost"
                              onPress={() => {
                                setTargetEmail(user.email);
                                setIsAutocompleteOpen(false);
                              }}
                              className="h-auto w-full justify-start gap-2.5 px-2.5 py-2 text-left"
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-600 text-[11px] font-bold text-white">
                                {getUserInitials(user.name, user.email)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <Text variant="label" className="block truncate text-white">
                                  {user.name}
                                </Text>
                                <Text
                                  variant="mono"
                                  className="block truncate text-[11px] text-slate-400"
                                >
                                  {user.email}
                                </Text>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="p-3 text-center">
                        <Text variant="label" className="block text-slate-300">
                          Không có thành viên nào trùng khớp
                        </Text>
                        <Text variant="caption" className="mt-0.5 block text-slate-500">
                          Bạn vẫn có thể chia sẻ cho email này (chờ đăng ký)
                        </Text>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                isDisabled={!targetEmail.trim()}
                className="shrink-0"
              >
                {!isSubmitting && <Plus className="h-4 w-4" />}
                Lưu quyền chia sẻ
              </Button>
            </div>
          </div>

          <SharePermissionMatrix permissions={permissions} onChange={setPermissions} />
        </form>

        <div className="space-y-3 border-t border-slate-800 pt-2">
          <div className="flex items-center justify-between">
            <Heading level={3}>Đang chia sẻ với ({shares.length}):</Heading>
            <Text variant="caption" className="text-[11px] text-slate-400">
              Bấm vào dòng để sửa nhanh quyền
            </Text>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Đang tải danh sách chia sẻ...</span>
            </div>
          ) : shares.length === 0 ? (
            <EmptyState
              title="Chưa có ai được chia sẻ dự án này"
              description="Nhập email thành viên phía trên để cấp quyền truy cập."
            />
          ) : (
            <div className="space-y-2">
              {shares.map((share) => {
                const isRegistered = Boolean(share.sharedWithUserId);
                const isDeleting = deletingShareId === share.id;

                return (
                  <div
                    key={share.id}
                    onClick={() => {
                      setTargetEmail(share.sharedWithEmail);
                      setPermissions(share.permissions);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 transition hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {share.sharedWithEmail}
                        </span>
                        {share.sharedUserName && (
                          <span className="text-[11px] text-slate-400">
                            ({share.sharedUserName})
                          </span>
                        )}
                        {isRegistered ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <UserCheck className="h-3 w-3" />
                            <span>Đang hoạt động</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                            <UserX className="h-3 w-3" />
                            <span>Chờ đăng ký</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {SHARE_MODULE_META.map((mod) => {
                          const perm = share.permissions[mod.key];
                          if (perm._tag !== "Enabled") return null;
                          const hasEdit = perm.actions.includes("edit");
                          const hasExport = perm.actions.includes("export");
                          return (
                            <span
                              key={mod.key}
                              className={`rounded-md border px-2 py-0.5 font-medium ${
                                hasEdit
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                  : hasExport
                                    ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                                    : "border-slate-800 bg-slate-900 text-slate-400"
                              }`}
                            >
                              {mod.title}: {perm.actions.join(", ")}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <IconButton
                      aria-label={`Thu hồi quyền chia sẻ của ${share.sharedWithEmail}`}
                      variant="ghost"
                      isDisabled={isDeleting}
                      onPress={() => {
                        void handleRemoveShare(share.id, share.sharedWithEmail);
                      }}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-slate-500 hover:text-rose-400" />
                      )}
                    </IconButton>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-slate-800 pt-3">
          <Button variant="secondary" onPress={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </Modal>
  );
}
