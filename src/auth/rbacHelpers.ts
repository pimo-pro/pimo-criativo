import { PERMISSIONS } from "./permissionsMap";
import type { AuthUser } from "./AuthContext";

/**
 * Usar sempre `hasPermission` do `AuthProvider` (lista efectiva vinda de `/me`).
 * `admin.full_access` implica todas as verificações abaixo.
 */
export function hasEffectivePermission(
  hasPermission: (permission: string) => boolean,
  permission: string
): boolean {
  return hasPermission(permission);
}

export function hasFullAccess(hasPermission: (permission: string) => boolean): boolean {
  return hasPermission(PERMISSIONS.ADMIN_FULL_ACCESS);
}

/** Listagem remota com scope=all (só admin — ver todos os projectos). */
export function canViewAllProjects(hasPermission: (permission: string) => boolean): boolean {
  return hasFullAccess(hasPermission) || hasPermission(PERMISSIONS.PROJECT_VIEW_ALL);
}

/** Ultra+ e partilhas usam scope=mine expandido no servidor — não scope=all. */
export function canViewExpandedProjectList(
  hasPermission: (permission: string) => boolean,
  effectiveRole?: string
): boolean {
  return (
    canViewAllProjects(hasPermission) ||
    effectiveRole === "ultra+"
  );
}

/** Ver pelo menos os próprios projetos (qualquer utilizador autenticado com role mínima). */
export function canViewOwnProjects(hasPermission: (permission: string) => boolean): boolean {
  return (
    hasFullAccess(hasPermission) ||
    hasPermission(PERMISSIONS.PROJECT_VIEW_SELF) ||
    hasPermission(PERMISSIONS.PROJECT_VIEW_ALL)
  );
}

/**
 * Editar / arquivar / apagar projeto: só dono com `project.edit.self`, ou admin com `admin.full_access`.
 * Não confundir com ver todos — ultra+ vê todos mas não deve apagar terceiros no UI.
 */
export function canEditProject(
  hasPermission: (permission: string) => boolean,
  currentUserId: string | undefined,
  projectOwnerId: string
): boolean {
  if (hasFullAccess(hasPermission)) return true;
  const uid = (currentUserId ?? "").trim();
  if (!uid) return false;
  return projectOwnerId === uid && hasPermission(PERMISSIONS.PROJECT_EDIT_SELF);
}

export const canDeleteProject = canEditProject;
export const canRenameProject = canEditProject;

export function canMutateEveryListedProject(
  hasPermission: (permission: string) => boolean,
  currentUserId: string | undefined,
  projects: { ownerId: string }[]
): boolean {
  return projects.every((p) => canEditProject(hasPermission, currentUserId, p.ownerId));
}

/** Rotas /admin/*, Navbar, Footer (LegacyApp). */
export function canAccessAdminPanel(hasPermission: (permission: string) => boolean): boolean {
  return hasFullAccess(hasPermission) || hasPermission(PERMISSIONS.USER_MANAGE_BELOW);
}

/** Secção de utilizadores (UI; API real de users no PHP continua só admin). */
export function canManageUsers(hasPermission: (permission: string) => boolean): boolean {
  return canAccessAdminPanel(hasPermission);
}

/** Showroom multi-projeto — admin (scope=all). */
export function canOpenProjectsShowroom(hasPermission: (permission: string) => boolean): boolean {
  return canViewAllProjects(hasPermission);
}

/** Envio para produção (futuro); hoje sem UI dedicada. */
export function canSendProjectToProduction(
  hasPermission: (permission: string) => boolean,
  currentUserId: string | undefined,
  projectOwnerId: string
): boolean {
  if (hasFullAccess(hasPermission)) return true;
  const uid = (currentUserId ?? "").trim();
  if (!uid) return false;
  return (
    projectOwnerId === uid && hasPermission(PERMISSIONS.PROJECT_SEND_TO_PRODUCTION_SELF)
  );
}

/** Compatível com código que ainda passa `user`; a decisão é só por `hasPermission`. */
export function canAccessAdminFeatures(
  _user: AuthUser | null | undefined,
  hasPermission: (permission: string) => boolean
): boolean {
  void _user;
  return canAccessAdminPanel(hasPermission);
}
