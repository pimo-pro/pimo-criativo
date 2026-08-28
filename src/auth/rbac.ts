/**
 * RBAC no cliente — reexport central.
 * Lógica: `rbacHelpers.ts`; constantes: `permissionsMap.ts`.
 */
export { ALL_KNOWN_PERMISSIONS, PERMISSIONS, type PermissionId } from "./permissionsMap";
export {
  canAccessAdminFeatures,
  canAccessAdminPanel,
  canDeleteProject,
  canEditProject,
  canManageUsers,
  canMutateEveryListedProject,
  canOpenProjectsShowroom,
  canRenameProject,
  canSendProjectToProduction,
  canViewAllProjects,
  canViewExpandedProjectList,
  canViewOwnProjects,
  hasEffectivePermission,
  hasFullAccess,
} from "./rbacHelpers";
