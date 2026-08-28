export const INVITE_CODE_INVALID_MESSAGE = "Código de convite inválido ou expirado";

export type InviteUsageMode = "single" | "multi";
export type InviteAssignableRole = "pro" | "ultra" | "ultra+";
export type InviteDerivedStatus = "activo" | "usado" | "desactivado";

export type InviteCodeRecord = {
  id: string;
  code: string;
  role: InviteAssignableRole | string;
  usageMode: InviteUsageMode | string;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  status?: InviteDerivedStatus | string;
  createdAt: string;
  createdBy?: string | null;
  disabledAt?: string | null;
  disabledBy?: string | null;
  lastUsedAt?: string | null;
};

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isInviteUsable(invite: {
  active?: boolean;
  usageMode?: string;
  usedCount?: number;
  usageLimit?: number | null;
}): boolean {
  if (invite.active !== true) return false;
  const mode = String(invite.usageMode ?? "single");
  const used = Number(invite.usedCount ?? 0);
  if (mode === "single") return used < 1;
  const limit = invite.usageLimit;
  if (limit === null || limit === undefined) return true;
  return used < Number(limit);
}

export function deriveInviteStatus(invite: {
  active?: boolean;
  usageMode?: string;
  usedCount?: number;
  usageLimit?: number | null;
}): InviteDerivedStatus {
  const used = Number(invite.usedCount ?? 0);
  const mode = String(invite.usageMode ?? "single");
  const active = invite.active === true;
  if (active && isInviteUsable(invite)) return "activo";
  if (mode === "single" && used >= 1) return "usado";
  return "desactivado";
}
