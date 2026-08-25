/**
 * Espelho TypeScript das regras PHP em api/authz/resourceAccess.php
 * (testável sem PHP CLI). Mantém IDOR / ownership alinhados com o backend.
 */

export type AuthzUser = {
  id: string;
  username: string;
  role: string;
  permissions: string[];
};

export function authzHas(user: AuthzUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

export function authzIsPlatformAdmin(user: AuthzUser): boolean {
  return authzHas(user, "admin.full_access") || user.role === "admin";
}

export function authzCanViewAllProjects(user: AuthzUser): boolean {
  return authzHas(user, "project.view.all") || authzIsPlatformAdmin(user);
}

export function authzCanViewProject(
  user: AuthzUser,
  project: { ownerId?: string }
): boolean {
  if (authzCanViewAllProjects(user)) return true;
  const ownerId = project.ownerId ?? "";
  return ownerId !== "" && ownerId === user.id;
}

export function authzCanMutateProject(
  user: AuthzUser,
  existingProject: { ownerId?: string } | null
): boolean {
  if (authzIsPlatformAdmin(user)) return true;
  if (!authzHas(user, "project.edit.self")) return false;
  if (existingProject === null) return true;
  const ownerId = existingProject.ownerId ?? "";
  return ownerId !== "" && ownerId === user.id;
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
