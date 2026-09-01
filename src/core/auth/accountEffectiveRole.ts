import { PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_ROLE } from "./platformAdmin";

export type AccountStatus = "approved" | "pending";

export type AuthUserAccountFields = {
  accountStatus?: AccountStatus;
  requestedRole?: string | null;
  effectiveRole?: string;
  accountCategory?: string | null;
  invitedViaCodeId?: string | null;
  emailVerified?: boolean;
};

/** Role efectivo para RBAC — pending usa sempre visitor até aprovação manual. */
export function resolveEffectiveRole(user: {
  role: string;
  accountStatus?: AccountStatus;
}): string {
  if (user.accountStatus === "pending") {
    return "visitor";
  }
  const role = String(user.role ?? "").trim().toLowerCase();
  return role || "visitor";
}

export function isAccountPending(user: { accountStatus?: AccountStatus }): boolean {
  return user.accountStatus === "pending";
}

export function isAccountApproved(user: { accountStatus?: AccountStatus }): boolean {
  return user.accountStatus !== "pending";
}

/**
 * Contas que devem confirmar email antes do login.
 * Excluídas: admin (role ou email), legadas aprovadas sem accountCategory,
 * visitor orgânico, e contas já com emailVerified=true (confirmação única).
 */
export function userMustConfirmEmail(user: {
  role?: string;
  email?: string;
  accountStatus?: AccountStatus;
  accountCategory?: string | null;
  invitedViaCodeId?: string | null;
  emailVerified?: boolean;
}): boolean {
  const role = String(user.role ?? "").trim().toLowerCase();
  if (role === PLATFORM_ADMIN_ROLE) {
    return false;
  }
  const email = String(user.email ?? "").trim().toLowerCase();
  if (email === PLATFORM_ADMIN_EMAIL.toLowerCase()) {
    return false;
  }
  if (user.emailVerified === true) {
    return false;
  }
  const category = String(user.accountCategory ?? "").trim().toLowerCase();
  const invited = Boolean(user.invitedViaCodeId && String(user.invitedViaCodeId).trim());
  if (category === "visitor" && !invited) {
    return false;
  }
  if (category === "" && user.accountStatus !== "pending") {
    return false;
  }
  return true;
}

export function userRequiresEmailVerification(user: {
  accountStatus?: AccountStatus;
  accountCategory?: string | null;
  invitedViaCodeId?: string | null;
  emailVerified?: boolean;
}): boolean {
  return userMustConfirmEmail(user) && user.emailVerified !== true;
}

export function isEmailVerifiedForLogin(user: {
  accountStatus?: AccountStatus;
  accountCategory?: string | null;
  invitedViaCodeId?: string | null;
  emailVerified?: boolean;
}): boolean {
  if (!userMustConfirmEmail(user)) {
    return true;
  }
  return user.emailVerified === true;
}
