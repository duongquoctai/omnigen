"use client";

import { FolderOpen, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { UserAvatarMenu, type UserAvatarMenuUser } from "@/contexts/access";
import { IconButton, SelectField, StatusChip, StudioBreadcrumbs, Text } from "@/shared/ui";

export interface HeaderFolderItem {
  readonly id: string;
  readonly name: string;
}

export interface StudioHeaderBarProps {
  readonly parentProjectId: string;
  readonly parentProjectName: string;
  readonly folderId: string;
  readonly folderName: string;
  readonly siblingFolders: ReadonlyArray<HeaderFolderItem>;
  readonly renderedCount: number;
  readonly isOwner: boolean;
  readonly onOpenShare: () => void;
  readonly currentUser?: UserAvatarMenuUser | null | undefined;
  readonly onLogout?: (() => Promise<unknown>) | undefined;
}

export function StudioHeaderBar({
  parentProjectId,
  parentProjectName,
  folderId,
  folderName,
  siblingFolders,
  renderedCount,
  isOwner,
  onOpenShare,
  currentUser = null,
  onLogout,
}: StudioHeaderBarProps) {
  const router = useRouter();
  const folderOptions = siblingFolders.map((f) => ({
    value: f.id,
    label: f.name,
  }));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-[#04050c]/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <StudioBreadcrumbs
          items={[
            { id: "projects", label: "Dự án", href: "/" },
            {
              id: "parent",
              label: parentProjectName,
              href: `/projects/${parentProjectId}`,
            },
          ]}
        />

        {folderOptions.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <SelectField
              ariaLabel="Chuyển nhanh thư mục"
              value={folderId}
              onValueChange={(nextId) => {
                if (nextId !== folderId) {
                  router.push(`/projects/${parentProjectId}/folders/${nextId}`);
                }
              }}
              options={folderOptions}
              className="w-48"
            />
          </div>
        ) : (
          <Text variant="label" className="truncate text-white">
            {folderName}
          </Text>
        )}

        <StatusChip color="default" variant="soft" size="sm" className="hidden sm:inline-flex">
          Đã render: {renderedCount} video
        </StatusChip>
      </div>

      <div className="flex items-center gap-2">
        {isOwner ? (
          <IconButton
            aria-label="Chia sẻ dự án"
            variant="secondary"
            size="sm"
            onPress={onOpenShare}
          >
            <Share2 className="h-4 w-4" />
          </IconButton>
        ) : null}
        <UserAvatarMenu user={currentUser} showProjectsShortcut={true} onLogout={onLogout} />
      </div>
    </header>
  );
}
