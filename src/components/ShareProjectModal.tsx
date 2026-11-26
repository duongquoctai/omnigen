"use client";

import {
  Check,
  CheckCircle2,
  Film,
  History,
  Layers,
  Loader2,
  Mail,
  Plus,
  Share2,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getUserInitials } from "@/components/UserAvatarMenu";
import {
  DEFAULT_SHARE_PERMISSIONS,
  ModuleAction,
  ProjectSharePermissions,
  ResourceShare,
  UserSafeProfile,
} from "@/types/lachvid";

interface ShareProjectModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onToast: (toast: { type: "info" | "success" | "error"; text: string }) => void;
}

export default function ShareProjectModal({
  projectId,
  projectName,
  onClose,
  onToast,
}: ShareProjectModalProps) {
  const [shares, setShares] = useState<Array<ResourceShare & { sharedUserName?: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [targetEmail, setTargetEmail] = useState<string>("");
  const [permissions, setPermissions] =
    useState<ProjectSharePermissions>(DEFAULT_SHARE_PERMISSIONS);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [deletingShareId, setDeletingShareId] = useState<string | null>(null);

  // Autocomplete danh sách user trong hệ thống
  const [systemUsers, setSystemUsers] = useState<UserSafeProfile[]>([]);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState<boolean>(false);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);

  // Load danh sách những người đang được share
  const loadShares = useCallback(async () => {
    try {
      const res = await fetch(`/api/parent-projects/${projectId}/shares`);
      const data = await res.json();
      if (res.ok && data.shares) {
        setShares(data.shares);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/parent-projects/${projectId}/shares`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.shares) {
          setShares(data.shares);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    // Tải danh sách user trong hệ thống để phục vụ autocomplete
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.users) {
          setSystemUsers(data.users);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [projectId]);

  // Click outside listener để đóng dropdown autocomplete
  useEffect(() => {
    if (!isAutocompleteOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        autocompleteContainerRef.current &&
        !autocompleteContainerRef.current.contains(e.target as Node)
      ) {
        setIsAutocompleteOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isAutocompleteOpen]);

  // Tập hợp email của những người đã được chia sẻ dự án (để ẩn khỏi gợi ý)
  const sharedEmailsSet = useMemo(() => {
    return new Set(shares.map((s) => s.sharedWithEmail.toLowerCase().trim()));
  }, [shares]);

  // Danh sách user autocomplete thỏa điều kiện tìm kiếm và chưa có trong shares
  const filteredUsers = useMemo(() => {
    const q = targetEmail.trim().toLowerCase();
    return systemUsers.filter((u) => {
      // Ẩn người đã được chia sẻ
      if (sharedEmailsSet.has(u.email.toLowerCase().trim())) {
        return false;
      }
      // Nếu chưa nhập ký tự nào, hiển thị toàn bộ người chưa được chia sẻ
      if (!q) return true;
      // Nếu có ký tự, lọc theo tên hoặc email
      return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
    });
  }, [systemUsers, sharedEmailsSet, targetEmail]);

  // Toggle action cho module: khi bật export/edit -> tự động bật view & enabled
  const handleToggleAction = (moduleKey: keyof ProjectSharePermissions, action: ModuleAction) => {
    setPermissions((prev) => {
      const current = prev[moduleKey] || { enabled: false, actions: [] };
      const currentActions = new Set(current.actions);

      if (currentActions.has(action)) {
        currentActions.delete(action);
        // Nếu bỏ view thì bỏ hết
        if (action === "view") {
          currentActions.clear();
        }
      } else {
        currentActions.add(action);
        // Nếu bật edit hoặc export thì bắt buộc bật view
        if (action === "edit" || action === "export") {
          currentActions.add("view");
        }
      }

      const actionsArr = Array.from(currentActions);
      return {
        ...prev,
        [moduleKey]: {
          enabled: actionsArr.length > 0,
          actions: actionsArr,
        },
      };
    });
  };

  // Toggle toàn bộ module
  const handleToggleModule = (moduleKey: keyof ProjectSharePermissions) => {
    setPermissions((prev) => {
      const current = prev[moduleKey];
      if (current.enabled) {
        return {
          ...prev,
          [moduleKey]: { enabled: false, actions: [] },
        };
      }
      return {
        ...prev,
        [moduleKey]: { enabled: true, actions: ["view", "export"] },
      };
    });
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = targetEmail.trim().toLowerCase();
    if (!email) {
      onToast({ type: "error", text: "Vui lòng nhập email người nhận." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/parent-projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, permissions }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể chia sẻ dự án.");
      }

      onToast({
        type: "success",
        text: `Đã cấp quyền chia sẻ thành công cho ${email}.`,
      });
      setTargetEmail("");
      setPermissions(DEFAULT_SHARE_PERMISSIONS);
      loadShares();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onToast({ type: "error", text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveShare = async (shareId: string, email: string) => {
    setDeletingShareId(shareId);
    try {
      const res = await fetch(
        `/api/parent-projects/${projectId}/shares?shareId=${encodeURIComponent(shareId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể thu hồi quyền chia sẻ.");
      }

      onToast({
        type: "success",
        text: `Đã thu hồi quyền chia sẻ của ${email}.`,
      });
      loadShares();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onToast({ type: "error", text: msg });
    } finally {
      setDeletingShareId(null);
    }
  };

  const handleEditExistingShare = (share: ResourceShare) => {
    setTargetEmail(share.sharedWithEmail);
    setPermissions(share.permissions);
  };

  const modulesList: Array<{
    key: keyof ProjectSharePermissions;
    title: string;
    icon: React.ReactNode;
    desc: string;
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
      desc: "Xem danh sách video, tải video MP4, bật/tắt trạng thái sử dụng hoặc xóa",
    },
  ];

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col space-y-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-7">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-600/20 text-indigo-400">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-white sm:text-base">
                <span>Chia sẻ dự án</span>
                <span className="max-w-[200px] truncate rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-normal text-indigo-300">
                  {projectName}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Phân quyền chi tiết theo từng module cho thành viên trong nhóm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          {/* Share Form */}
          <form onSubmit={handleShareSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Email người nhận <span className="text-rose-400">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1" ref={autocompleteContainerRef}>
                  <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={targetEmail}
                    onFocus={() => setIsAutocompleteOpen(true)}
                    onChange={(e) => {
                      setTargetEmail(e.target.value);
                      setIsAutocompleteOpen(true);
                    }}
                    placeholder="thanhvien@example.com"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pr-3.5 pl-10 text-xs text-slate-200 transition placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  />

                  {/* Dropdown danh sách gợi ý autocomplete */}
                  {isAutocompleteOpen && (
                    <div className="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-56 divide-y divide-slate-800/60 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
                      {filteredUsers.length > 0 ? (
                        <>
                          <div className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                            Thành viên trong hệ thống ({filteredUsers.length})
                          </div>
                          <div className="space-y-0.5 pt-1">
                            {filteredUsers.map((u) => {
                              const initials = getUserInitials(u.name, u.email);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={() => {
                                    setTargetEmail(u.email);
                                    setIsAutocompleteOpen(false);
                                  }}
                                  className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-slate-800"
                                >
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-400/30 bg-indigo-600 text-[11px] font-bold text-white">
                                    {initials}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-bold text-white transition group-hover:text-indigo-300">
                                      {u.name}
                                    </p>
                                    <p className="truncate font-mono text-[11px] text-slate-400">
                                      {u.email}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <div className="p-3 text-center">
                          <p className="text-xs font-medium text-slate-300">
                            Không có thành viên nào trùng khớp
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Bạn vẫn có thể chia sẻ cho email này (Chờ đăng ký)
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !targetEmail.trim()}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Lưu quyền chia sẻ</span>
                </button>
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="space-y-2.5">
              <label className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>Ma trận quyền theo từng module:</span>
                <span className="text-[11px] font-normal text-slate-500">
                  (Cấp quyền edit sẽ cho phép tạo/xóa folder con)
                </span>
              </label>

              <div className="divide-y divide-slate-800/80 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
                {modulesList.map((mod) => {
                  const modConfig = permissions[mod.key] || {
                    enabled: false,
                    actions: [],
                  };
                  const isEnabled = modConfig.enabled;

                  return (
                    <div
                      key={mod.key}
                      className={`p-3.5 transition sm:p-4 ${
                        isEnabled ? "bg-slate-900/40" : "opacity-60"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleModule(mod.key)}
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                              isEnabled
                                ? "border-indigo-500 bg-indigo-600 text-white"
                                : "border-slate-700 bg-slate-950"
                            }`}
                          >
                            {isEnabled && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                          </button>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              {mod.icon}
                              <h4 className="text-xs font-bold text-white">{mod.title}</h4>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-400">{mod.desc}</p>
                          </div>
                        </div>

                        {/* Actions pills: Xuống dòng lệch phải, chữ không bị rớt dòng */}
                        <div className="flex items-center justify-end gap-2 border-t border-slate-800/60 pt-2">
                          {(["view", "export", "edit"] as ModuleAction[]).map((action) => {
                            const isChecked = isEnabled && modConfig.actions.includes(action);
                            const actionLabels: Record<ModuleAction, string> = {
                              view: "Xem",
                              export: "Tải / xuất",
                              edit: "Chỉnh sửa",
                            };

                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => handleToggleAction(mod.key, action)}
                                className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                                  isChecked
                                    ? "border-indigo-500/50 bg-indigo-600/20 text-indigo-300 shadow-sm"
                                    : "border-slate-800 bg-slate-950 text-slate-500 hover:text-slate-300"
                                }`}
                              >
                                {actionLabels[action]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>

          {/* List of currently shared users */}
          <div className="space-y-3 border-t border-slate-800 pt-2">
            <h3 className="flex items-center justify-between text-xs font-bold text-white">
              <span>Đang chia sẻ với ({shares.length}):</span>
              <span className="text-[11px] font-normal text-slate-400">
                Bấm vào dòng để sửa nhanh quyền
              </span>
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                <span>Đang tải danh sách chia sẻ...</span>
              </div>
            ) : shares.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-xs text-slate-500">
                Chưa có ai được chia sẻ dự án này.
              </div>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => {
                  const isRegistered = Boolean(share.sharedWithUserId);
                  const isDeleting = deletingShareId === share.id;

                  return (
                    <div
                      key={share.id}
                      onClick={() => handleEditExistingShare(share)}
                      className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 transition hover:border-slate-700"
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

                        {/* Active permissions badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {modulesList.map((m) => {
                            const p = share.permissions[m.key];
                            if (!p?.enabled) return null;
                            const hasEdit = p.actions.includes("edit");
                            const hasExport = p.actions.includes("export");
                            return (
                              <span
                                key={m.key}
                                className={`rounded-md border px-2 py-0.5 font-medium ${
                                  hasEdit
                                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                    : hasExport
                                      ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                                      : "border-slate-800 bg-slate-900 text-slate-400"
                                }`}
                              >
                                {m.title}: {p.actions.join(", ")}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveShare(share.id, share.sharedWithEmail);
                        }}
                        className="shrink-0 rounded-xl border border-transparent p-2 text-slate-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400"
                        title="Thu hồi quyền chia sẻ"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
