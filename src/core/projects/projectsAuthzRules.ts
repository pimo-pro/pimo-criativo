/**
 * Espelho TypeScript das regras PHP em api/authz/resourceAccess.php
 * (testável sem PHP CLI). Mantém IDOR / ownership alinhados com o backend.
 */

export type AuthzUser = {
  id: string;
  username: string;
  role: string;
  effectiveRole?: string;
  accountStatus?: "approved" | "pending";
  permissions: string[];
};

export type AuthzContext = {
  sharedProjectIds?: Set<string>;
  platformAdminId?: string | null;
};

export function authzHas(user: AuthzUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

export function authzEffectiveRole(user: AuthzUser): string {
  if (user.accountStatus === "pending") {
    return "visitor";
  }
  return user.effectiveRole ?? user.role;
}

export function authzIsPlatformAdmin(user: AuthzUser): boolean {
  return authzHas(user, "admin.full_access") || authzEffectiveRole(user) === "admin";
}

/** Listagem scope=all — só admin / project.view.all (não ultra+). */
export function authzCanViewAllProjects(user: AuthzUser): boolean {
  return authzHas(user, "project.view.all") || authzIsPlatformAdmin(user);
}

function authzUltraPlusAdminProjectAccess(
  user: AuthzUser,
  projectOwnerId: string,
  ctx: AuthzContext
): boolean {
  if (authzEffectiveRole(user) !== "ultra+") return false;
  if (user.accountStatus === "pending") return false;
  const adminId = ctx.platformAdminId ?? null;
  return Boolean(adminId && projectOwnerId === adminId);
}

function authzHasShare(_user: AuthzUser, projectId: string, ctx: AuthzContext): boolean {
  if (!projectId || !ctx.sharedProjectIds?.size) return false;
  return ctx.sharedProjectIds.has(projectId);
}

export function authzListIncludesProject(
  user: AuthzUser,
  project: { id?: string; ownerId?: string },
  ctx: AuthzContext = {}
): boolean {
  if (authzCanViewAllProjects(user)) return true;
  const ownerId = project.ownerId ?? "";
  const projectId = project.id?.trim() ?? "";
  if (ownerId !== "" && ownerId === user.id) return true;
  if (projectId && authzHasShare(user, projectId, ctx)) return true;
  if (ownerId !== "" && authzUltraPlusAdminProjectAccess(user, ownerId, ctx)) return true;
  return false;
}

export function authzCanViewProject(
  user: AuthzUser,
  project: { id?: string; ownerId?: string },
  ctx: AuthzContext = {}
): boolean {
  return authzListIncludesProject(user, project, ctx);
}

export function authzCanMutateProject(
  user: AuthzUser,
  existingProject: { id?: string; ownerId?: string } | null,
  ctx: AuthzContext = {}
): boolean {
  if (authzIsPlatformAdmin(user)) return true;
  if (!authzHas(user, "project.edit.self")) return false;
  if (existingProject === null) {
    return user.accountStatus !== "pending";
  }
  return authzCanViewProject(user, existingProject, ctx);
}

export function authzBindProjectOwner(
  user: AuthzUser,
  project: Record<string, unknown>,
  existingProject: { ownerId?: string; ownerName?: string } | null
): Record<string, unknown> {
  if (
    existingProject &&
    authzIsPlatformAdmin(user) &&
    existingProject.ownerId
  ) {
    return {
      ...project,
      ownerId: existingProject.ownerId,
      ownerName: existingProject.ownerName ?? existingProject.ownerId,
    };
  }
  return {
    ...project,
    ownerId: user.id,
    ownerName: user.username || user.id,
  };
}

export function authzCanSendToProduction(user: AuthzUser): boolean {
  return authzHas(user, "project.send_to_production.self") || authzIsPlatformAdmin(user);
}
