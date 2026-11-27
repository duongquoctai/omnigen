"use client";

import { Option } from "effect";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ShareProjectModal, type UserAvatarMenuUser } from "@/contexts/access";
import { type ClipLibrary, MixTab, type VoiceClip } from "@/contexts/composition";
import {
  type CategoryMinDurations,
  type Shot,
  type SourceVideo,
  SplitTab,
} from "@/contexts/footage";
import { HistoryTab, recordRenderedBatchAction, type RenderedRecord } from "@/contexts/rendering";
import type { FolderId } from "@/contexts/shared-kernel";
import { StatusChip } from "@/shared/ui";

import { WorkspaceHeader } from "../workspace-header";
import { usePermission } from "./permission-context";
import {
  hydrateLibraryFromDto,
  hydrateMinDurationsFromDto,
  hydrateRecordsFromDto,
  hydrateShotsFromDto,
  hydrateSourceVideoFromDto,
  hydrateVoicesFromDto,
  type PlainCategoryMinDurationsDto,
  type PlainLibraryDto,
  type PlainRenderedRecordDto,
  type PlainShotDto,
  type PlainSourceVideoDto,
  type PlainVoiceDto,
} from "./studio-initial-dto";
import { StudioSidebar } from "./studio-sidebar";
import { type StudioTab, useStudioTab } from "./studio-tab";
import { useToast } from "./toast-context";

export interface SiblingFolderItem {
  readonly id: string;
  readonly name: string;
}

export interface StudioWorkspaceViewProps {
  readonly parentProjectId: string;
  readonly parentProjectName: string;
  readonly folderId: FolderId;
  readonly folderName: string;
  readonly siblingFolders?: ReadonlyArray<SiblingFolderItem> | undefined;
  readonly sessionId: string;
  readonly initialTab?: StudioTab | undefined;
  readonly initialShots: ReadonlyArray<Shot>;
  readonly initialSourceVideoUrl?: string | null | undefined;
  readonly initialSourceVideoDto?: PlainSourceVideoDto | null | undefined;
  readonly initialShotsDto?: ReadonlyArray<PlainShotDto> | undefined;
  readonly initialMinDurationsDto?: PlainCategoryMinDurationsDto | undefined;
  readonly initialLibrary?: ClipLibrary | undefined;
  readonly initialVoices?: ReadonlyArray<VoiceClip> | undefined;
  readonly initialRecords?: ReadonlyArray<RenderedRecord> | undefined;
  readonly initialLibraryDto?: PlainLibraryDto | undefined;
  readonly initialVoicesDto?: ReadonlyArray<PlainVoiceDto> | undefined;
  readonly initialRecordsDto?: ReadonlyArray<PlainRenderedRecordDto> | undefined;
  readonly maxVideoDuration?: number | undefined;
  readonly currentUser?: UserAvatarMenuUser | null | undefined;
  readonly onLogout?: (() => Promise<unknown>) | undefined;
}

const TAB_ITEMS: ReadonlyArray<{
  readonly id: StudioTab;
  readonly label: string;
}> = [
  { id: "split", label: "1. Tách cảnh" },
  { id: "mix", label: "2. Trộn video" },
  { id: "history", label: "3. Lịch sử render" },
];

export function StudioWorkspaceView({
  parentProjectId,
  parentProjectName,
  folderId,
  folderName,
  sessionId,
  initialTab = "split",
  initialShots,
  initialSourceVideoUrl = null,
  initialSourceVideoDto = null,
  initialShotsDto,
  initialMinDurationsDto,
  initialLibrary,
  initialVoices,
  initialRecords,
  initialLibraryDto,
  initialVoicesDto,
  initialRecordsDto,
  maxVideoDuration = 60,
  currentUser = null,
  onLogout,
}: StudioWorkspaceViewProps) {
  useRouter();
  const [activeTab, setActiveTab] = useStudioTab(initialTab);
  const { role, can } = usePermission();
  const isOwner = role._tag === "Owner";
  const { addToast } = useToast();
  const [isShareOpen, setIsShareOpen] = useState(false);

  const resolvedSourceVideo = useMemo<SourceVideo | null>(
    () => hydrateSourceVideoFromDto(initialSourceVideoDto),
    [initialSourceVideoDto],
  );

  const resolvedShots = useMemo<ReadonlyArray<Shot>>(
    () => (initialShots.length > 0 ? initialShots : hydrateShotsFromDto(initialShotsDto)),
    [initialShots, initialShotsDto],
  );

  const resolvedMinDurations = useMemo<CategoryMinDurations | undefined>(
    () => hydrateMinDurationsFromDto(initialMinDurationsDto),
    [initialMinDurationsDto],
  );

  const resolvedLibrary = useMemo<ClipLibrary>(
    () =>
      initialLibrary ??
      (initialLibraryDto
        ? hydrateLibraryFromDto(initialLibraryDto)
        : { open: [], product: [], texture: [], apply: [], end: [] }),
    [initialLibrary, initialLibraryDto],
  );

  const resolvedVoices = useMemo<ReadonlyArray<VoiceClip>>(
    () => initialVoices ?? (initialVoicesDto ? hydrateVoicesFromDto(initialVoicesDto) : []),
    [initialVoices, initialVoicesDto],
  );

  const resolvedRecords = useMemo<ReadonlyArray<RenderedRecord>>(
    () => initialRecords ?? (initialRecordsDto ? hydrateRecordsFromDto(initialRecordsDto) : []),
    [initialRecords, initialRecordsDto],
  );
  const [records, setRecords] = useState<ReadonlyArray<RenderedRecord>>(resolvedRecords);

  const defaultMixPrefix = useMemo(() => {
    const pName = parentProjectName.trim();
    const fName = folderName.trim();
    if (pName && fName && pName !== fName) {
      return `${pName} - ${fName}`;
    }
    return fName || pName;
  }, [parentProjectName, folderName]);

  const handleRecordRenderedBatch = async (
    entries: ReadonlyArray<{
      readonly tupleKey: string;
      readonly name: string;
      readonly payload?: unknown;
    }>,
  ) => {
    const res = await recordRenderedBatchAction({
      folderId,
      records: entries,
    });
    if (!res.ok) {
      addToast("error", res.error);
      return;
    }
    const hydrated: ReadonlyArray<RenderedRecord> = res.data.records.map((r) => ({
      ...r,
      outputUrl: r.outputUrl ? Option.some(r.outputUrl) : Option.none(),
    }));
    setRecords((prev) => [...hydrated, ...prev]);
  };

  const visibleTabs = TAB_ITEMS.filter((tab) => can(tab.id, "view"));
  const firstVisibleTab = visibleTabs.at(0);
  const currentTab =
    visibleTabs.find((t) => t.id === activeTab)?.id ?? firstVisibleTab?.id ?? "split";

  return (
    <div className="flex min-h-screen flex-col bg-[#04050c] text-zinc-100">
      <WorkspaceHeader
        breadcrumbs={[
          { id: "projects", label: "Dự án", href: "/" },
          {
            id: "parent",
            label: parentProjectName,
            href: `/projects/${parentProjectId}`,
          },
          { id: "folder", label: folderName },
        ]}
        statusBadge={
          <StatusChip color="default" variant="soft" size="sm" className="hidden sm:inline-flex">
            Đã render: {records.length} video
          </StatusChip>
        }
        onOpenShare={
          isOwner
            ? () => {
                setIsShareOpen(true);
              }
            : undefined
        }
        currentUser={currentUser}
        showProjectsShortcut={true}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1">
        <StudioSidebar
          activeTab={currentTab}
          visibleTabs={visibleTabs}
          onSelectTab={(tab) => {
            void setActiveTab(tab);
          }}
          renderedCount={records.length}
        />

        <main className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 px-4 py-5 sm:px-6">
          {currentTab === "split" && (
            <SplitTab
              sessionId={sessionId}
              folderId={folderId}
              initialShots={resolvedShots}
              initialSourceVideoUrl={initialSourceVideoUrl ?? resolvedSourceVideo?.localUrl ?? null}
              initialSourceVideo={resolvedSourceVideo}
              initialMinDurations={resolvedMinDurations}
              maxVideoDuration={maxVideoDuration}
            />
          )}

          {currentTab === "mix" && (
            <MixTab
              folderId={folderId}
              defaultClipPrefix={defaultMixPrefix}
              initialLibrary={resolvedLibrary}
              initialVoices={resolvedVoices}
              canEdit={can("mix", "edit")}
              canExport={can("mix", "export")}
              renderedTupleKeys={records.map((r) => r.tupleKey)}
              onRecordRenderedBatch={handleRecordRenderedBatch}
              onToast={(t) => {
                addToast(t.type, t.text);
              }}
            />
          )}

          {currentTab === "history" && (
            <HistoryTab
              folderId={folderId}
              initialRecords={records}
              voices={resolvedVoices}
              library={resolvedLibrary}
              canEdit={can("history", "edit")}
              canExport={can("history", "export")}
              onRecordsChange={setRecords}
              onToast={(t) => {
                addToast(t.type, t.text);
              }}
            />
          )}
        </main>
      </div>

      {isShareOpen && (
        <ShareProjectModal
          isOpen={isShareOpen}
          projectId={parentProjectId}
          projectName={parentProjectName}
          onClose={() => {
            setIsShareOpen(false);
          }}
          onToast={(t) => {
            addToast(t.type, t.text);
          }}
        />
      )}
    </div>
  );
}
