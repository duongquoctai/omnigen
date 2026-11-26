export * from "./domain/schemas";
export { CreateProjectDialog, type CreateProjectDialogProps } from "./ui/create-project-dialog";
export {
  type FolderListItem,
  ProjectFoldersView,
  type ProjectFoldersViewProps,
} from "./ui/project-folders-view";
export {
  type DashboardProjectItem,
  type DashboardUser,
  ProjectsDashboard,
  type ProjectsDashboardProps,
} from "./ui/projects-dashboard";
export { PermissionProvider, usePermission } from "./ui/studio-shell/permission-context";
export type {
  PlainCategoryMinDurationsDto,
  PlainClipDto,
  PlainLibraryDto,
  PlainRenderedRecordDto,
  PlainShotDto,
  PlainSourceVideoDto,
  PlainVoiceDto,
} from "./ui/studio-shell/studio-initial-dto";
export { StudioShell, type StudioShellProps } from "./ui/studio-shell/studio-shell";
export { useStudioTab } from "./ui/studio-shell/studio-tab";
export { STUDIO_TABS, type StudioTab } from "./ui/studio-shell/studio-tab-constants";
export {
  StudioWorkspaceView,
  type StudioWorkspaceViewProps,
} from "./ui/studio-shell/studio-workspace-view";
export {
  type ToastItem,
  ToastProvider,
  type ToastType,
  useToast,
} from "./ui/studio-shell/toast-context";
