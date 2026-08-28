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
 * Visitor orgânico (sem convite): não.
 * Pending, não-visitor, ou approved via convite: sim.
 */
export function userMustConfirmEmail(user: {
  accountStatus?: AccountStatus;
  accountCategory?: string | null;
  invitedViaCodeId?: string | null;
}): boolean {
  const category = String(user.accountCategory ?? "").trim().toLowerCase();
  const invited = Boolean(user.invitedViaCodeId && String(user.invitedViaCodeId).trim());
  if (category === "visitor" && !invited) {
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
