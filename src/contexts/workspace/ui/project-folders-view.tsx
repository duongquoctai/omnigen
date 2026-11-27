"use client";

import { CheckCircle2, Film, FolderOpen, Plus, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";

import { ShareProjectModal, type UserAvatarMenuUser } from "@/contexts/access";
import { useActionForm } from "@/shared/hooks/use-action-form";
import {
  AlertBanner,
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  Heading,
  Modal,
  SearchInput,
  Text,
  TextInput,
} from "@/shared/ui";

import { CreateFolderInput } from "../domain/schemas";
import { createFolderAction, deleteFolderAction } from "./actions";
import { EditFolderDialog } from "./edit-folder-dialog";
import { FolderCard, type FolderListItem } from "./folder-card";
import { WorkspaceHeader } from "./workspace-header";

export type { FolderListItem };

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

export function ProjectFoldersView({
  project,
  initialFolders,
  canManageFolders,
  currentUser = null,
  onLogout,
}: ProjectFoldersViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useQueryState("q", parseAsString.withDefault(""));
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

  const filteredFolders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return initialFolders;
    return initialFolders.filter((folder) => {
      const haystack = `${folder.name} ${folder.description ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [initialFolders, searchQuery]);

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
      <WorkspaceHeader
        breadcrumbs={[
          { id: "projects", label: "Dự án", href: "/" },
          { id: "project", label: project.name },
        ]}
        onOpenShare={
          isOwner
            ? () => {
                setShowShare(true);
              }
            : undefined
        }
        currentUser={currentUser}
        showProjectsShortcut={true}
        onLogout={onLogout}
      />

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
          <div className="max-w-xl space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Heading level={2} className="text-xl font-bold text-white">
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
              <Text variant="caption" as="div" className="text-xs leading-relaxed text-zinc-400">
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

          {canManageFolders ? (
            <Button
              size="sm"
              variant="primary"
              onPress={() => {
                setShowCreate(true);
              }}
              className="h-9 px-4 text-xs font-semibold shadow-lg shadow-indigo-600/25"
            >
              <Plus className="h-4 w-4" />
              Tạo folder mới
            </Button>
          ) : null}
        </div>

        {initialFolders.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={searchQuery}
              onValueChange={(value) => {
                void setSearchQuery(value);
              }}
              placeholder="Tìm kiếm folder..."
              ariaLabel="Tìm kiếm folder"
              className="w-full sm:max-w-xs"
            />
          </div>
        ) : null}

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
        ) : filteredFolders.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-10 w-10" />}
            title="Không tìm thấy folder phù hợp"
            description="Thử nhập từ khóa khác để tìm kiếm."
            action={
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  void setSearchQuery("");
                }}
              >
                Xóa tìm kiếm
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                projectId={project.id}
                folder={folder}
                canManageFolders={canManageFolders}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            ))}
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
