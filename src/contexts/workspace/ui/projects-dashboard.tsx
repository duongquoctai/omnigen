"use client";

import { FolderOpen, Plus, SearchX } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";

import { ShareProjectModal } from "@/contexts/access";
import {
  AlertBanner,
  Button,
  ConfirmDialog,
  EmptyState,
  Heading,
  SearchInput,
  Text,
} from "@/shared/ui";

import { createProjectAction, deleteProjectAction } from "./actions";
import { CreateProjectDialog } from "./create-project-dialog";
import { EditProjectDialog } from "./edit-project-dialog";
import { type DashboardProjectItem, ProjectCard } from "./project-card";
import { WorkspaceHeader } from "./workspace-header";

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

const SCOPE_VALUES = ["all", "mine", "shared"] as const;
type ProjectScope = (typeof SCOPE_VALUES)[number];

export function ProjectsDashboard({
  initialProjects,
  currentUser,
  dbStatus,
  onLogout,
}: ProjectsDashboardProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useQueryState("q", parseAsString.withDefault(""));
  const [scope, setScope] = useQueryState(
    "scope",
    parseAsStringLiteral(SCOPE_VALUES).withDefault("all"),
  );
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

  const scopeCounts = useMemo(() => {
    let mine = 0;
    let shared = 0;
    for (const p of initialProjects) {
      if (p.isOwner === false) {
        shared += 1;
      } else {
        mine += 1;
      }
    }
    return { all: initialProjects.length, mine, shared };
  }, [initialProjects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return initialProjects.filter((project) => {
      const isOwner = project.isOwner !== false;
      if (scope === "mine" && !isOwner) return false;
      if (scope === "shared" && isOwner) return false;
      if (!normalizedQuery) return true;
      const haystack =
        `${project.name} ${project.description ?? ""} ${project.ownerName ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [initialProjects, scope, searchQuery]);

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

  const filterOptions: ReadonlyArray<{
    readonly id: ProjectScope;
    readonly label: string;
    readonly count: number;
  }> = [
    { id: "all", label: "Tất cả", count: scopeCounts.all },
    { id: "mine", label: "Của tôi", count: scopeCounts.mine },
    { id: "shared", label: "Được chia sẻ", count: scopeCounts.shared },
  ];

  const hasActiveFilters = searchQuery.trim().length > 0 || scope !== "all";

  return (
    <div className="min-h-screen bg-[#04050c] text-zinc-100">
      <WorkspaceHeader currentUser={currentUser} onLogout={onLogout} />

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
            className="h-9 px-4 text-xs font-semibold shadow-lg shadow-indigo-600/25"
          >
            <Plus className="h-4 w-4" />
            Tạo dự án
          </Button>
        </div>

        {initialProjects.length > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchInput
              value={searchQuery}
              onValueChange={(value) => {
                void setSearchQuery(value);
              }}
              placeholder="Tìm kiếm dự án..."
              ariaLabel="Tìm kiếm dự án"
              className="w-full sm:max-w-xs"
            />

            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Lọc dự án"
            >
              {filterOptions.map((opt) => {
                const isActive = scope === opt.id;
                return (
                  <Button
                    key={opt.id}
                    size="sm"
                    variant={isActive ? "primary" : "secondary"}
                    onPress={() => {
                      void setScope(opt.id);
                    }}
                    className="h-8 px-3 text-xs font-medium"
                  >
                    {opt.label} ({opt.count})
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

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
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-10 w-10" />}
            title="Không tìm thấy dự án phù hợp"
            description="Thử đổi từ khóa tìm kiếm hoặc chuyển sang bộ lọc khác."
            action={
              hasActiveFilters ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    void setSearchQuery("");
                    void setScope("all");
                  }}
                >
                  Xóa bộ lọc
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
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
