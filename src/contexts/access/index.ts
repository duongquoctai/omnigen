export { verifySessionToken } from "./adapters/token-verifier";
export * from "./domain/auth";
export {
  AccessRole,
  accessRoleFromLegacy,
  canManageFolders,
  canPerform,
  canViewModule,
  firstAllowedTab,
  type LegacyProjectAccessInfo,
  MODULE_ACTIONS,
  ModuleAction,
  ModulePermission,
  ModulePermissions,
  STUDIO_MODULES,
  StudioModule,
} from "./domain/permissions";
export * from "./domain/sharing";
export { AuthScreen, type AuthScreenProps } from "./ui/auth-screen";
export { LoginForm, type LoginFormProps } from "./ui/login-form";
export { ShareProjectModal, type ShareProjectModalProps } from "./ui/share-project-modal";
export {
  UserAvatarMenu,
  type UserAvatarMenuProps,
  type UserAvatarMenuUser,
} from "./ui/user-avatar-menu";
