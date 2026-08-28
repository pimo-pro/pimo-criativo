import { describe, expect, it } from "vitest";

import {
  INVITE_CODE_INVALID_MESSAGE,
  deriveInviteStatus,
  isInviteUsable,
  normalizeInviteCode,
} from "./inviteCodeRules";

describe("inviteCodeRules", () => {
  it("normaliza código", () => {
    expect(normalizeInviteCode("  pimo-pro ")).toBe("PIMO-PRO");
  });

  it("single activo e sem usos é utilizável", () => {
    expect(isInviteUsable({ active: true, usageMode: "single", usedCount: 0 })).toBe(true);
    expect(isInviteUsable({ active: true, usageMode: "single", usedCount: 1 })).toBe(false);
    expect(isInviteUsable({ active: false, usageMode: "single", usedCount: 0 })).toBe(false);
  });

  it("multi ilimitado permanece utilizável", () => {
    expect(
      isInviteUsable({ active: true, usageMode: "multi", usedCount: 99, usageLimit: null })
    ).toBe(true);
  });

  it("deriva estado activo / usado / desactivado", () => {
    expect(deriveInviteStatus({ active: true, usageMode: "single", usedCount: 0 })).toBe("activo");
    expect(deriveInviteStatus({ active: false, usageMode: "single", usedCount: 1 })).toBe("usado");
    expect(deriveInviteStatus({ active: false, usageMode: "multi", usedCount: 0 })).toBe(
      "desactivado"
    );
  });

  it("mensagem de inválido está definida", () => {
    expect(INVITE_CODE_INVALID_MESSAGE.length).toBeGreaterThan(10);
  });
});
