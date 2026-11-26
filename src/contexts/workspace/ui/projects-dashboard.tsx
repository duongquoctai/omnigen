"use client";

import { Film, FolderOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ShareProjectModal, UserAvatarMenu } from "@/contexts/access";
import { AlertBanner, Button, ConfirmDialog, EmptyState, Heading, Text } from "@/shared/ui";

import { createProjectAction, deleteProjectAction } from "./actions";
import { CreateProjectDialog } from "./create-project-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { type DashboardProjectItem, ProjectCard } from "./project-card";

export type { DashboardProjectItem };

export interface DashboardUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface DashboardDbStatus {
  readonly isCloud: boolean;
  readonly connected: boolean;
  readonly error?: string | undefined;
}

export interface ProjectsDashboardProps {
  readonly initialProjects: ReadonlyArray<DashboardProjectItem>;
  readonly currentUser: DashboardUser | null;
  readonly dbStatus?: DashboardDbStatus | undefined;
  readonly onLogout: () => Promise<unknown>;
}

export function ProjectsDashboard({
  initialProjects,
  currentUser,
  dbStatus,
  onLogout,
}: ProjectsDashboardProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<DashboardProjectItem | null>(null);
  const [shareTarget, setShareTarget] = useState<DashboardProjectItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DashboardProjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{
    readonly type: "info" | "success" | "error";
    readonly text: string;
  } | null>(null);

  const ownerId = currentUser?.id ?? "usr_skin1004";

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteProjectAction({ id: deleteTarget.id });
      if (res.ok) {
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#04050c] text-zinc-100">
      <header className="sticky top-0 z-40 bg-[#04050c]/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 transition hover:opacity-90"
            title="Về trang chủ OmniGen"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-500 shadow-lg shadow-rose-500/20">
              <Film className="h-5 w-5 text-white" />
            </div>
            <div>
              <Heading level={1} className="text-sm font-extrabold tracking-tight text-white">
                OmniGen
              </Heading>
              <Text variant="caption" className="block text-[11px] text-zinc-400">
                Hệ thống tách video slicer &amp; trộn lách content mỹ phẩm
              </Text>
            </div>
          </Link>

          <UserAvatarMenu user={currentUser} onLogout={onLogout} />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {dbStatus?.isCloud && !dbStatus.connected ? (
          <AlertBanner
            status="warning"
            title="Kết nối SQLite Cloud tạm thời gián đoạn (đang dùng dữ liệu cục bộ)"
          >
            {dbStatus.error ?? "Đang sử dụng dữ liệu cục bộ."}
          </AlertBanner>
        ) : null}

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
                Quản lý dự án &amp; thương hiệu
              </Heading>
              <span className="rounded-full border border-indigo-500/35 bg-indigo-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                Project layer
              </span>
            </div>
            <Text variant="caption" as="div" className="text-xs leading-relaxed text-zinc-400">
              Mỗi dự án đại diện cho một thương hiệu hoặc chiến dịch lớn. Bên trong mỗi dự án, bạn
              có thể tạo các folder cho từng dòng sản phẩm để quản lý kho clip và lịch sử render độc
              lập.
            </Text>
          </div>

          <Button
            size="sm"
            variant="primary"
            onPress={() => {
              setShowCreate(true);
            }}
            className="h-10 rounded-full !bg-indigo-600 px-5 text-xs font-semibold !text-white shadow-lg shadow-indigo-600/30 hover:!bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Tạo dự án
          </Button>
        </div>

        {initialProjects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-10 w-10" />}
            title="Chưa có dự án nào"
            description="Tạo dự án đầu tiên để tổ chức các thư mục làm việc và kho video."
            action={
              <Button
                variant="primary"
                onPress={() => {
                  setShowCreate(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Tạo dự án
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onShare={setShareTarget}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog
        isOpen={showCreate}
        onOpenChange={setShowCreate}
        onCreateProject={async (input) => {
          const res = await createProjectAction({
            name: input.name,
            description: input.description,
            ownerId,
          });
          if (res.ok) {
            router.refresh();
          }
          return res;
        }}
      />

      <EditProjectDialog
        project={editTarget}
        onClose={() => {
          setEditTarget(null);
        }}
        onUpdated={() => {
          router.refresh();
        }}
      />

      {shareTarget ? (
        <ShareProjectModal
          isOpen={Boolean(shareTarget)}
          projectId={shareTarget.id}
          projectName={shareTarget.name}
          onClose={() => {
            setShareTarget(null);
          }}
          onToast={setToast}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Xóa dự án"
        description={`Bạn có chắc muốn xóa dự án "${deleteTarget?.name ?? ""}" và toàn bộ thư mục bên trong?`}
        confirmLabel="Xóa dự án"
        isDestructive
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
