export type AccountStatus = "approved" | "pending";

export type AuthUserAccountFields = {
  accountStatus?: AccountStatus;
  requestedRole?: string | null;
  effectiveRole?: string;
  accountCategory?: string | null;
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
