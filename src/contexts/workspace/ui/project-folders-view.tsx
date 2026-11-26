"use client";

import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Film,
  Folder,
  FolderOpen,
  MoreVertical,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ShareProjectModal, UserAvatarMenu, type UserAvatarMenuUser } from "@/contexts/access";
import { useActionForm } from "@/shared/hooks/use-action-form";
import {
  ActionMenuDropdown,
  type ActionMenuItem,
  AlertBanner,
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  Heading,
  IconButton,
  Modal,
  Text,
  TextInput,
} from "@/shared/ui";

import { CreateFolderInput } from "../domain/schemas";
import { createFolderAction, deleteFolderAction } from "./actions";
import { EditFolderDialog } from "./edit-folder-dialog";

export interface FolderListItem {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly poolCount?: number | undefined;
  readonly renderedCount?: number | undefined;
  readonly updatedAt?: string | undefined;
}

export interface ProjectFoldersViewProps {
  readonly project: {
    readonly id: string;
    readonly name: string;
    readonly description?: string | undefined;
    readonly isOwner?: boolean | undefined;
  };
  readonly initialFolders: ReadonlyArray<FolderListItem>;
  readonly canManageFolders: boolean;
  readonly currentUser?: UserAvatarMenuUser | null | undefined;
  readonly onLogout?: (() => Promise<unknown>) | undefined;
}

const formatDateDdMmYyyy = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
};

export function ProjectFoldersView({
  project,
  initialFolders,
  canManageFolders,
  currentUser = null,
  onLogout,
}: ProjectFoldersViewProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [editTarget, setEditTarget] = useState<FolderListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{
    readonly type: "info" | "success" | "error";
    readonly text: string;
  } | null>(null);

  const { form, serverError, isSubmitting, onSubmit } = useActionForm({
    schema: CreateFolderInput,
    defaultValues: { projectId: project.id, name: "", description: "" },
    action: createFolderAction,
    onSuccess: () => {
      form.reset({ projectId: project.id, name: "", description: "" });
      setShowCreate(false);
      router.refresh();
    },
  });

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteFolderAction({
        id: deleteTarget.id,
        projectId: project.id,
      });
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const totalClips = initialFolders.reduce((sum, f) => sum + (f.poolCount ?? 0), 0);
  const totalRendered = initialFolders.reduce((sum, f) => sum + (f.renderedCount ?? 0), 0);
  const isOwner = project.isOwner !== false;

  return (
    <div className="min-h-screen bg-[#04050c] text-zinc-100">
      <header className="sticky top-0 z-40 bg-[#04050c]/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
              aria-label="Quay lại danh sách dự án"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <Link href="/" className="text-zinc-400 transition hover:text-zinc-200">
                Dự án
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="truncate font-semibold text-white">{project.name}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {isOwner ? (
              <IconButton
                size="sm"
                variant="ghost"
                aria-label="Chia sẻ dự án"
                onPress={() => {
                  setShowShare(true);
                }}
                className="h-8 w-8 rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                <Share2 className="h-3.5 w-3.5" />
              </IconButton>
            ) : null}
            <UserAvatarMenu user={currentUser} showProjectsShortcut={true} onLogout={onLogout} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {toast ? (
          <div
            role="status"
            className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs ${
              toast.type === "error"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                : toast.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-indigo-500/40 bg-indigo-500/10 text-indigo-200"
            }`}
          >
            <span>{toast.text}</span>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setToast(null);
              }}
            >
              Đóng
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <Heading level={1} className="text-xl font-bold text-white">
                {project.name}
              </Heading>
              <span className="rounded-full border border-indigo-500/35 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                {initialFolders.length} folder
              </span>
              {isOwner ? (
                <span className="rounded-full border border-indigo-500/35 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                  Chủ sở hữu
                </span>
              ) : (
                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  Được chia sẻ
                </span>
              )}
            </div>

            {project.description ? (
              <Text variant="caption" as="div" className="text-xs text-zinc-400">
                {project.description}
              </Text>
            ) : null}

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <span className="inline-flex items-center gap-1.5 text-sky-400">
                <Film className="h-3.5 w-3.5" />
                {totalClips} clip tổng
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {totalRendered} video đã render
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isOwner ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setShowShare(true);
                }}
                className="h-10 rounded-full border border-zinc-800 bg-zinc-900/80 px-4 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
              >
                <Share2 className="h-3.5 w-3.5" />
                Chia sẻ dự án
              </Button>
            ) : null}
            {canManageFolders ? (
              <Button
                size="sm"
                variant="primary"
                onPress={() => {
                  setShowCreate(true);
                }}
                className="h-10 rounded-full !bg-indigo-600 px-5 text-xs font-semibold !text-white shadow-lg shadow-indigo-600/30 hover:!bg-indigo-500"
              >
                <Plus className="h-4 w-4" />
                Tạo folder mới
              </Button>
            ) : null}
          </div>
        </div>

        {initialFolders.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-10 w-10" />}
            title="Chưa có thư mục làm việc nào"
            description="Tạo thư mục đầu tiên để tách cảnh và phối trộn video."
            action={
              canManageFolders ? (
                <Button
                  variant="primary"
                  onPress={() => {
                    setShowCreate(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tạo folder mới
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialFolders.map((folder) => {
              const updatedStr = formatDateDdMmYyyy(folder.updatedAt);
              const folderMenuItems: Array<ActionMenuItem> = canManageFolders
                ? [
                    {
                      id: "edit",
                      label: "Đổi tên folder",
                      icon: <Pencil className="h-3.5 w-3.5 text-zinc-300" />,
                      onAction: () => {
                        setEditTarget(folder);
                      },
                    },
                    {
                      id: "delete",
                      label: "Xóa folder",
                      icon: <Trash2 className="h-3.5 w-3.5 text-rose-400" />,
                      isDanger: true,
                      onAction: () => {
                        setDeleteTarget(folder);
                      },
                    },
                  ]
                : [];

              return (
                <div
                  key={folder.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-800/80 bg-[#0a0c16] p-5 transition-colors hover:border-indigo-500/40"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/15 text-indigo-300">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/projects/${project.id}/folders/${folder.id}`}
                            className="block truncate text-sm font-bold text-white transition hover:text-indigo-300"
                          >
                            {folder.name}
                          </Link>
                          {updatedStr ? (
                            <Text
                              variant="muted"
                              className="mt-0.5 block text-[11px] text-zinc-500"
                            >
                              Cập nhật {updatedStr}
                            </Text>
                          ) : null}
                        </div>
                      </div>

                      {folderMenuItems.length > 0 ? (
                        <ActionMenuDropdown
                          ariaLabel={`Thao tác cho folder ${folder.name}`}
                          items={folderMenuItems}
                          triggerClassName="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-200"
                          trigger={<MoreVertical className="h-4 w-4" />}
                        />
                      ) : null}
                    </div>

                    {folder.description ? (
                      <Text
                        variant="caption"
                        as="div"
                        className="line-clamp-2 text-xs text-zinc-400"
                      >
                        {folder.description}
                      </Text>
                    ) : null}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 pt-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-sky-400">
                        <Film className="h-3.5 w-3.5" />
                        {folder.poolCount ?? 0} clip
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {folder.renderedCount ?? 0} đã render
                      </span>
                    </div>

                    <Link
                      href={`/projects/${project.id}/folders/${folder.id}`}
                      className="inline-flex shrink-0 items-center gap-0.5 font-medium text-indigo-400 transition hover:text-indigo-300"
                    >
                      Mở folder
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Modal
        isOpen={showCreate}
        onOpenChange={setShowCreate}
        title="Tạo folder mới"
        description="Mỗi folder là một không gian studio độc lập."
      >
        <form
          onSubmit={(e) => {
            void onSubmit(e);
          }}
          className="space-y-4"
        >
          <input type="hidden" {...form.register("projectId")} />
          <FormField label="Tên folder" error={form.formState.errors.name?.message} isRequired>
            <TextInput placeholder="Ví dụ: Kem chống nắng" {...form.register("name")} />
          </FormField>
          <FormField label="Mô tả" error={form.formState.errors.description?.message}>
            <TextInput
              placeholder="Ghi chú ngắn (không bắt buộc)"
              {...form.register("description")}
            />
          </FormField>
          {serverError ? <AlertBanner status="danger">{serverError}</AlertBanner> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onPress={() => {
                setShowCreate(false);
              }}
              isDisabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Tạo folder
            </Button>
          </div>
        </form>
      </Modal>

      <EditFolderDialog
        projectId={project.id}
        folder={editTarget}
        onClose={() => {
          setEditTarget(null);
        }}
        onUpdated={() => {
          router.refresh();
        }}
      />

      {showShare ? (
        <ShareProjectModal
          isOpen={showShare}
          projectId={project.id}
          projectName={project.name}
          onClose={() => {
            setShowShare(false);
          }}
          onToast={setToast}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Xóa folder"
        description={`Bạn có chắc muốn xóa folder "${deleteTarget?.name ?? ""}"?`}
        confirmLabel="Xóa folder"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
