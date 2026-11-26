import { redirect } from "next/navigation";

import { accessRoleFromLegacy, firstAllowedTab } from "@/contexts/access";
import { logoutAction } from "@/contexts/access/ui/actions";
import type { ShotCategory } from "@/contexts/shared-kernel";
import {
  type PlainCategoryMinDurationsDto,
  type PlainClipDto,
  type PlainLibraryDto,
  type PlainRenderedRecordDto,
  type PlainShotDto,
  type PlainSourceVideoDto,
  type PlainVoiceDto,
  STUDIO_TABS,
  StudioShell,
  type StudioTab,
  StudioWorkspaceView,
} from "@/contexts/workspace";
import { getCurrentUser } from "@/lib/auth";
import {
  getFoldersByParentId,
  getParentProjectById,
  getProjectById,
  getProjectCategoryPools,
  getProjectVoiceTracks,
  getRenderedHistory,
  resolveFolderAccess,
} from "@/lib/db";
import { readProjectState } from "@/lib/store";

const isStudioTab = (value: string | undefined): value is StudioTab =>
  value !== undefined && (STUDIO_TABS as ReadonlyArray<string>).includes(value);

const toPlainClipDto = (item: {
  id: string;
  name: string;
  fileName: string;
  category: ShotCategory;
  duration: number;
  localUrl: string;
  localPath?: string;
  driveFileId?: string;
  lockFlipH?: boolean;
}): PlainClipDto => ({
  id: item.id,
  name: item.name,
  fileName: item.fileName,
  category: item.category,
  duration: item.duration,
  localUrl: item.localUrl,
  ...(item.localPath ? { localPath: item.localPath } : {}),
  ...(item.driveFileId ? { driveFileId: item.driveFileId } : {}),
  lockFlipH: Boolean(item.lockFlipH),
});

export default async function FolderWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; folderId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, folderId } = await params;
  const user = await getCurrentUser();
  const access = await resolveFolderAccess(folderId, user?.id, user?.email);

  if (access.role === "none") {
    redirect(`/projects/${id}`);
  }

  const [parentProject, folder, siblingFoldersRaw, pools, voiceTracks, renderedHistory] =
    await Promise.all([
      getParentProjectById(id),
      getProjectById(folderId),
      getFoldersByParentId(id),
      getProjectCategoryPools(folderId),
      getProjectVoiceTracks(folderId),
      getRenderedHistory(folderId),
    ]);

  const initialLibraryDto: PlainLibraryDto = {
    open: (pools.open ?? []).map(toPlainClipDto),
    product: (pools.product ?? []).map(toPlainClipDto),
    texture: (pools.texture ?? []).map(toPlainClipDto),
    apply: (pools.apply ?? []).map(toPlainClipDto),
    end: (pools.end ?? []).map(toPlainClipDto),
  };

  const initialVoicesDto: ReadonlyArray<PlainVoiceDto> = voiceTracks.map((v) => ({
    id: v.id,
    name: v.name,
    fileName: v.fileName,
    localUrl: v.localUrl,
    ...(v.localPath ? { localPath: v.localPath } : {}),
    duration: v.duration,
  }));

  const initialRecordsDto: ReadonlyArray<PlainRenderedRecordDto> = renderedHistory.map((rv) => ({
    id: rv.id,
    folderId,
    tupleKey: rv.tupleKey,
    name: rv.name ?? "Video đã render",
    status: rv.status === "used" ? "used" : "unused",
    renderedAt: rv.renderedAt,
    ...(rv.payload !== undefined ? { payload: rv.payload } : {}),
  }));

  const siblingFolders = siblingFoldersRaw.map((f) => ({
    id: f.id,
    name: f.name,
  }));

  const sp = searchParams ? await searchParams : undefined;
  const rawTab = typeof sp?.tab === "string" ? sp.tab : undefined;
  const accessRole = accessRoleFromLegacy(access);
  const initialTab: StudioTab = isStudioTab(rawTab) ? rawTab : firstAllowedTab(accessRole);

  const sessionState = readProjectState(folderId);
  const initialSourceVideoDto: PlainSourceVideoDto | null = sessionState.sourceVideo
    ? {
        id: sessionState.sourceVideo.id,
        name: sessionState.sourceVideo.name,
        fileName: sessionState.sourceVideo.fileName,
        localUrl: sessionState.sourceVideo.localUrl,
        localPath: sessionState.sourceVideo.localPath,
        duration: sessionState.sourceVideo.duration,
        width: sessionState.sourceVideo.width || 576,
        height: sessionState.sourceVideo.height || 1024,
        sizeBytes: sessionState.sourceVideo.sizeBytes || 0,
        createdAt: sessionState.sourceVideo.createdAt,
      }
    : null;

  const initialShotsDto: ReadonlyArray<PlainShotDto> = sessionState.shots.map((s) => ({
    id: s.id,
    sourceVideoId: sessionState.sourceVideo?.id ?? folderId,
    label: s.label,
    ...(s.category ? { category: s.category } : {}),
    begin: s.begin,
    end: s.end,
    speed: s.edits.speed,
    flipH: Boolean(s.edits.flipH),
    lockFlipH: Boolean(s.edits.lockFlipH),
  }));

  const initialMinDurationsDto: PlainCategoryMinDurationsDto = sessionState.categoryMinDurations;

  return (
    <StudioShell accessRole={accessRole}>
      <StudioWorkspaceView
        parentProjectId={id}
        parentProjectName={parentProject?.name ?? "Dự án"}
        folderId={folderId as never}
        folderName={folder?.name ?? "Thư mục làm việc"}
        siblingFolders={siblingFolders}
        sessionId={folderId}
        initialTab={initialTab}
        initialShots={[]}
        initialSourceVideoDto={initialSourceVideoDto}
        initialShotsDto={initialShotsDto}
        initialMinDurationsDto={initialMinDurationsDto}
        initialLibraryDto={initialLibraryDto}
        initialVoicesDto={initialVoicesDto}
        initialRecordsDto={initialRecordsDto}
        currentUser={user ? { id: user.id, name: user.name, email: user.email } : null}
        onLogout={async () => {
          "use server";
          await logoutAction({});
        }}
      />
    </StudioShell>
  );
}
